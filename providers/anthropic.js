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

// Resolve which model to call. If ANTHROPIC_MODEL is set, trust it. Otherwise
// ask the API which models THIS key can access and pick the cheapest sensible
// one (Haiku > Sonnet > whatever's first). Cached after the first lookup so we
// don't pay the round-trip on every chat.
let cachedModel = null;
async function resolveModel() {
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
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

const SYSTEM = `You are Scout, a warm, sharp, expert travel assistant living inside a travel-planning iOS app.
Your tagline is "Your perfect trip, scouted."

You can answer ANY question — but you shine on travel: destinations, best time to visit, budgets,
visas, safety, weather, packing, food, neighborhoods, getting around, comparisons, and itineraries.

Behavior:
- Answer conversationally and concisely. You're on a phone screen — keep it tight, skimmable,
  and friendly. Use short paragraphs or compact bullet lists. No long essays.
- When the user clearly wants you to PLAN or BOOK a specific trip (they name a destination and
  want to go, e.g. "plan 5 days in Tokyo under $2k", "find me a beach trip in July"), call the
  plan_trip tool with a concise search query. The app will fetch live flights, stays, activities
  and restaurants and render a trip card.
- For everything else (a question, advice, brainstorming, "where should I go for X?"), just
  answer. Do NOT call the tool for general questions. If they're still deciding where to go,
  help them decide first, then offer to plan it.
- Never invent specific live prices or flight numbers in text — the trip card provides those.
- Be honest if you're unsure. You are not a licensed financial, legal, or medical advisor.`;

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
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
