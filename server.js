import http from 'node:http';
import { planTrip } from './lib/normalize.js';
import { chat as claudeChat, hasClaude, listModels } from './providers/anthropic.js';

const PORT = process.env.PORT || 8787;

// Read and JSON-parse a request body (small payloads only).
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) reject(new Error('payload too large'));
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
async function handleChat(messages) {
  const history = (messages || [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.content || '';

  if (!hasClaude()) {
    // No AI key yet — keep working by always planning a trip (legacy behavior).
    const plan = await planTrip(lastUser || 'trip');
    return { reply: plan.intro, followUp: plan.followUp, trip: plan.trip };
  }

  const { text, toolQuery } = await claudeChat(history);

  if (toolQuery) {
    const plan = await planTrip(toolQuery || lastUser);
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
    if (url.pathname === '/health') {
      res.end(JSON.stringify({
        ok: true,
        service: 'scout-backend',
        ai: hasClaude(),
        keys: {
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          liteapi: !!(process.env.LITEAPI_KEY || process.env.LITEAPI_SANDBOX_KEY),
          travelpayouts: !!process.env.TRAVELPAYOUTS_TOKEN,
          yelp: !!process.env.YELP_API_KEY,
          viator: !!process.env.VIATOR_API_KEY,
        },
      }));
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
      const result = await handleChat(messages);
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
      const plan = await planTrip(q);
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
