// Scout's conversational brain — Anthropic Messages API (zero-dependency, built-in fetch).
//
// Exposes `chat(messages)` which lets Claude either ANSWER a travel question
// directly, or decide to PLAN A TRIP by calling the `plan_trip` tool. The server
// runs the real provider search when that tool is requested.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODELS_URL = 'https://api.anthropic.com/v1/models';
const VERSION = '2023-06-01';

export function hasClaude() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Resolve which model to call.
//
// Pinned by default. The old behavior asked the API which models the key could
// access and took the first Haiku it found — which happened to be the cheapest,
// but nothing guaranteed it. This key can also reach claude-opus-5 ($5/$25) and
// claude-fable-5 ($10/$50); a change in that list would have silently multiplied
// the bill by 5-10x with no code change and no alert.
//
// Also accepts SCOUT_MODEL, which render.yaml and .env were already setting
// against a variable nothing read.
const DEFAULT_MODEL = 'claude-haiku-4-5';

let cachedModel = null;
async function resolveModel() {
  const pinned = process.env.ANTHROPIC_MODEL || process.env.SCOUT_MODEL || DEFAULT_MODEL;
  if (pinned) return pinned;
  if (cachedModel) return cachedModel;

  const res = await fetch(MODELS_URL, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': VERSION,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic models ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const ids = (data.data || []).map((m) => m.id);
  // Prefer cheapest-to-priciest, newest-looking first within each family.
  const pick =
    ids.filter((id) => id.includes('haiku')).sort().reverse()[0] ||
    ids.filter((id) => id.includes('sonnet')).sort().reverse()[0] ||
    ids[0];
  if (!pick) throw new Error('Anthropic: no models available for this key');
  cachedModel = pick;
  return pick;
}

const SYSTEM = `You are Scout. You live in a travel app and you talk like a friend who travels a lot —
someone texting back, not an assistant filing a report.

VOICE — this matters more than anything else here.

Talk like a person. Short. Direct. Opinionated. You've been there, you have a take, you give it.

Never do these. They are what make an app sound like a chatbot:
- Opening filler: "Great question!", "Absolutely!", "I'd be happy to help", "Ah, Tokyo!"
- Restating the question before answering it.
- Hype adjectives: amazing, incredible, stunning, vibrant, bustling, must-see, hidden gem,
  perfect, ultimate, unforgettable, charming.
- Closing offers: "Let me know if you'd like more!", "Happy to dig deeper!", "Hope this helps!"
  Just stop when you're done. No sign-off.
- Bullet lists for things that aren't lists. Most answers are one or two short paragraphs.
- Bold headers on a three-sentence answer.
- Hedging throat-clearing: "It's worth noting", "Keep in mind that", "That said".
- Emoji.
- Saying three things when one is true. Don't pad to a rhythm.

Do this instead:
- Answer in the first sentence. Context after, if it's needed at all.
- Have a preference and say it. "Go in May, not August" beats "both have their merits".
- Contractions. Fragments are fine. One-line answers are fine.
- Concrete over general: a neighbourhood name, a number, a month.
- If something's overrated or a bad idea, say so plainly.

Tone check — write like the left column, not the right:
  "May. August is brutal and everything's booked."
    not "Great question! Both May and August offer unique advantages..."
  "Skip Shibuya Crossing, it's a road. Go to Shimokitazawa instead."
    not "Shibuya Crossing is an iconic must-see landmark!"
  "Four days is tight but doable if you skip Nara."
    not "Four days can absolutely work! Here are some tips to make the most of it:"

WHAT YOU DO

You know travel: where to go, when, what it costs, visas, weather, food, neighbourhoods,
getting around. You'll answer anything else too, in the same voice.

- When someone clearly wants a specific trip planned or booked — they name a place and want to
  go ("plan 5 days in Tokyo under $2k", "find me a beach trip in July") — call the plan_trip
  tool with a concise query. The app fetches live flights, stays, activities and eats and
  renders a card. Say a line or two in your own voice; don't describe what the card contains.
- For questions, advice, or someone still deciding, just answer. Don't call the tool. Help them
  pick first, then offer to plan it — once, casually.
- Never invent prices, flight numbers, or opening hours in text. The card carries real data.
  If you don't know, say you don't.
- On an attached PHOTO: look at it. Name the place if you can, read the menu or sign, read the
  vibe, and use it. If you can't tell what it is, say so and ask one short question.
- You're not a financial, legal, or medical advisor. Say when you're unsure.`;

const TOOLS = [
  {
    name: 'plan_trip',
    description:
      'Generate a full trip plan with LIVE flights, stays, activities and restaurants, rendered as a rich card in the app. Call this ONLY when the user clearly wants to plan or book a specific trip to a destination (or a concrete "find me a trip" request). Do NOT call it for general travel questions, advice, or when the user is still deciding where to go.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'A concise natural-language trip search query capturing destination, length, budget, dates and vibe when known. Example: "Tokyo 6 days under $2000 in spring, food-focused".',
        },
      },
      required: ['query'],
    },
  },
];

/**
 * Run one turn of conversation through Claude.
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
 * @returns {Promise<{ text:string, toolQuery:string|null, raw:object }>}
 */
export async function chat(messages) {
  const model = await resolveModel();
  const body = {
    model,
    max_tokens: 1024,
    system: SYSTEM,
    tools: TOOLS,
    // Support attached photos: when a message has image{data,mediaType}, send a
    // vision content block alongside the text so Claude can actually see it.
    messages: messages.map((m) => {
      if (m.image && m.image.data) {
        const blocks = [{
          type: 'image',
          source: { type: 'base64', media_type: m.image.mediaType || 'image/jpeg', data: m.image.data },
        }];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        return { role: m.role, content: blocks };
      }
      return { role: m.role, content: m.content };
    }),
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const blocks = Array.isArray(data.content) ? data.content : [];

  let text = '';
  let toolQuery = null;
  for (const b of blocks) {
    if (b.type === 'text') text += b.text;
    if (b.type === 'tool_use' && b.name === 'plan_trip') {
      toolQuery = (b.input && b.input.query) || '';
    }
  }

  return { text: text.trim(), toolQuery, raw: data };
}

/** Debug helper: list model IDs this key can access, and which one we'd pick. */
export async function listModels() {
  const res = await fetch(MODELS_URL, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': VERSION,
    },
  });
  const data = await res.json().catch(() => ({}));
  const ids = (data.data || []).map((m) => m.id);
  let picked = null;
  try { picked = await resolveModel(); } catch {}
  return { status: res.status, ids, picked };
}
