import http from 'node:http';
import { planTrip } from './lib/normalize.js';
import { chat as claudeChat, hasClaude, listModels } from './providers/anthropic.js';
import { freshOffer, prebook, book } from './providers/liteapi.js';
import { termsHTML, privacyHTML, supportHTML } from './legal.js';

const PORT = process.env.PORT || 8787;

// Read and JSON-parse a request body (small payloads only).
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 12_000_000) reject(new Error('payload too large')); // allow attached photos
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// The conversational brain. Claude answers any question and decides when to
// plan a trip; we run the real provider search for trip requests. Falls back
// to the rule-based planner if no ANTHROPIC_API_KEY is configured.
async function handleChat(messages, origin) {
  const history = (messages || [])
    .filter((m) => m && (typeof m.content === 'string' && m.content.trim() || m.image))
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
      image: m.image, // {data, mediaType} — passed to Claude vision
    }));

  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.content || '';

  if (!hasClaude()) {
    // No AI key yet — keep working by always planning a trip (legacy behavior).
    const plan = await planTrip(lastUser || 'trip', { origin });
    return { reply: plan.intro, followUp: plan.followUp, trip: plan.trip };
  }

  const { text, toolQuery } = await claudeChat(history);

  if (toolQuery) {
    const plan = await planTrip(toolQuery || lastUser, { origin });
    return {
      reply: text || plan.intro,
      followUp: plan.followUp,
      trip: plan.trip,
    };
  }

  return { reply: text, followUp: null, trip: null };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Hosted legal pages (real URLs for App Store review).
    if (url.pathname === '/legal/terms' || url.pathname === '/legal/privacy' || url.pathname === '/legal/support') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(url.pathname.endsWith('terms') ? termsHTML
            : url.pathname.endsWith('privacy') ? privacyHTML : supportHTML);
      return;
    }

    if (url.pathname === '/health') {
      res.end(JSON.stringify({
        ok: true,
        service: 'scout-backend',
        ai: hasClaude(),
        keys: {
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          liteapi: !!(process.env.LITEAPI_KEY || process.env.LITEAPI_SANDBOX_KEY),
          travelpayouts: !!process.env.TRAVELPAYOUTS_TOKEN,
          bookingAid: !!process.env.BOOKING_AID,
          googlePlaces: !!process.env.GOOGLE_PLACES_API_KEY,
          viator: !!process.env.VIATOR_API_KEY,
        },
      }));
      return;
    }

    // Hosted payment page — embeds LiteAPI's payment SDK. The app loads this in a
    // WebView; on success the SDK redirects to /pay/done?tid=&pid= which the app
    // intercepts to finalize the booking. `publicKey` is just the env string.
    if (url.pathname === '/pay') {
      const secret = url.searchParams.get('secret') || '';
      const env = (process.env.LITEAPI_KEY || '').startsWith('sand_') ? 'sandbox' : 'live';
      const base = `${url.protocol}//${req.headers.host}`;
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>body{margin:0;background:#0E0F13;color:#F5F5F7;font-family:-apple-system,system-ui;padding:16px}#targetElement{margin-top:8px}</style>
<script src="https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1"></script></head>
<body><div id="targetElement"></div>
<script>
  var cfg = {
    publicKey: ${JSON.stringify(env)},
    appearance: { theme: 'flat' },
    options: { business: { name: 'Scout' } },
    targetElement: '#targetElement',
    secretKey: ${JSON.stringify(secret)},
    returnUrl: ${JSON.stringify(base + '/pay/done')}
  };
  var p = new LiteAPIPayment(cfg);
  p.handlePayment();
</script></body></html>`);
      return;
    }
    if (url.pathname === '/pay/done') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html><body style="background:#0E0F13;color:#F5F5F7;font-family:-apple-system;text-align:center;padding-top:80px"><h2>Payment complete</h2><p>Finishing your booking…</p></body></html>');
      return;
    }

    // ---- Hotel booking flow (prebook → pay via SDK → book) ----
    if (url.pathname === '/hotels/offer' && req.method === 'POST') {
      const b = await readJson(req);
      res.end(JSON.stringify(await freshOffer(b)));
      return;
    }
    if (url.pathname === '/hotels/prebook' && req.method === 'POST') {
      const b = await readJson(req);
      if (!b.offerId) { res.statusCode = 400; res.end(JSON.stringify({ error: 'missing offerId' })); return; }
      res.end(JSON.stringify(await prebook(b.offerId)));
      return;
    }
    if (url.pathname === '/hotels/book' && req.method === 'POST') {
      const b = await readJson(req);
      if (!b.prebookId || !b.transactionId) {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'missing prebookId or transactionId' })); return;
      }
      res.end(JSON.stringify(await book(b)));
      return;
    }

    // Debug: run the LiteAPI stays pipeline and surface the real failure point.
    if (url.pathname === '/debug/stays') {
      const { debugStays } = await import('./providers/liteapi.js');
      const out = await debugStays({
        destination: url.searchParams.get('city') || 'Lisbon',
        country: url.searchParams.get('country') || 'Portugal',
        nights: 5,
      });
      res.end(JSON.stringify(out));
      return;
    }

    // Debug: which models can this key reach, and which one we'll use.
    if (url.pathname === '/models') {
      if (!hasClaude()) {
        res.end(JSON.stringify({ ai: false, error: 'no ANTHROPIC_API_KEY' }));
        return;
      }
      res.end(JSON.stringify(await listModels()));
      return;
    }

    // Conversational endpoint — Scout answers any question, plans trips when asked.
    if (url.pathname === '/chat') {
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'content-type');
        res.statusCode = 204;
        res.end();
        return;
      }
      let payload = {};
      if (req.method === 'POST') {
        payload = await readJson(req);
      } else {
        const q = url.searchParams.get('q') || '';
        payload = { messages: [{ role: 'user', content: q }] };
      }
      const messages = payload.messages || [];
      if (!messages.length) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'missing messages' }));
        return;
      }
      const origin = payload.origin || url.searchParams.get('origin');
      const result = await handleChat(messages, origin);
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/plan') {
      const q = url.searchParams.get('q') || '';
      if (!q.trim()) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'missing query param ?q=' }));
        return;
      }
      const plan = await planTrip(q, { origin: url.searchParams.get('origin') });
      res.end(JSON.stringify(plan));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err?.message || err) }));
  }
});

server.listen(PORT, () => {
  console.log(`Scout backend listening on http://localhost:${PORT}`);
  console.log(`Try: curl "http://localhost:${PORT}/plan?q=Tokyo%20in%20spring%20under%20%242k"`);
});
