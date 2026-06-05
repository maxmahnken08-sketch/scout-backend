// Turns a free-text trip request into structured search parameters.
// Uses Claude (Haiku) when ANTHROPIC_API_KEY is set; falls back to a heuristic
// parser so the backend runs with zero keys for local development.

const CITY_DB = {
  tokyo:     { destination: 'Tokyo',      country: 'Japan',        destinationCode: 'TYO' },
  japan:     { destination: 'Tokyo',      country: 'Japan',        destinationCode: 'TYO' },
  kyoto:     { destination: 'Kyoto',      country: 'Japan',        destinationCode: 'KIX' },
  lisbon:    { destination: 'Lisbon',     country: 'Portugal',     destinationCode: 'LIS' },
  porto:     { destination: 'Porto',      country: 'Portugal',     destinationCode: 'OPO' },
  paris:     { destination: 'Paris',      country: 'France',       destinationCode: 'PAR' },
  london:    { destination: 'London',     country: 'UK',           destinationCode: 'LON' },
  rome:      { destination: 'Rome',       country: 'Italy',        destinationCode: 'ROM' },
  milan:     { destination: 'Milan',      country: 'Italy',        destinationCode: 'MIL' },
  barcelona: { destination: 'Barcelona',  country: 'Spain',        destinationCode: 'BCN' },
  madrid:    { destination: 'Madrid',     country: 'Spain',        destinationCode: 'MAD' },
  amsterdam: { destination: 'Amsterdam',  country: 'Netherlands',  destinationCode: 'AMS' },
  berlin:    { destination: 'Berlin',     country: 'Germany',      destinationCode: 'BER' },
  athens:    { destination: 'Athens',     country: 'Greece',       destinationCode: 'ATH' },
  istanbul:  { destination: 'Istanbul',   country: 'Türkiye',      destinationCode: 'IST' },
  dubai:     { destination: 'Dubai',      country: 'UAE',          destinationCode: 'DXB' },
  bali:      { destination: 'Bali',       country: 'Indonesia',    destinationCode: 'DPS' },
  bangkok:   { destination: 'Bangkok',    country: 'Thailand',     destinationCode: 'BKK' },
  seoul:     { destination: 'Seoul',      country: 'South Korea',  destinationCode: 'SEL' },
  sydney:    { destination: 'Sydney',     country: 'Australia',    destinationCode: 'SYD' },
  baja:      { destination: 'Baja Sur',   country: 'Mexico',       destinationCode: 'SJD' },
  cancun:    { destination: 'Cancún',     country: 'Mexico',       destinationCode: 'CUN' },
  mexico:    { destination: 'Mexico City',country: 'Mexico',       destinationCode: 'MEX' },
  iceland:   { destination: 'Reykjavik',  country: 'Iceland',      destinationCode: 'KEF' },
  hawaii:    { destination: 'Honolulu',   country: 'USA',          destinationCode: 'HNL' },
  'new york':{ destination: 'New York',   country: 'USA',          destinationCode: 'NYC' },
  'los angeles': { destination: 'Los Angeles', country: 'USA',     destinationCode: 'LAX' },
  miami:     { destination: 'Miami',      country: 'USA',          destinationCode: 'MIA' },
};

// Best-effort destination name extraction for cities not in CITY_DB,
// so we don't silently default every unknown request to Tokyo.
function extractDestination(prompt) {
  const m = prompt.match(/\b(?:to|in|visit|explore|see|around)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/);
  return m ? m[1].trim() : null;
}

export async function parseIntent(prompt) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await parseIntentWithClaude(prompt);
    } catch (err) {
      console.warn('Claude intent parse failed, using heuristic:', err?.message || err);
    }
  }
  return heuristicIntent(prompt);
}

// --- Heuristic fallback (no API key needed) -------------------------------

function heuristicIntent(prompt) {
  const lower = prompt.toLowerCase();

  let city = null;
  for (const key of Object.keys(CITY_DB)) {
    if (lower.includes(key)) { city = CITY_DB[key]; break; }
  }
  // Unknown city → keep the user's destination name (no IATA code, so flights fall
  // back to placeholders) instead of silently defaulting everything to Tokyo.
  if (!city) {
    const name = extractDestination(prompt);
    city = name
      ? { destination: name, country: '', destinationCode: null }
      : { destination: 'Tokyo', country: 'Japan', destinationCode: 'TYO' };
  }

  // Budget: "$2,000", "2000", or "under 2k"
  let budgetLimit = 2000;
  const kMatch = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);
  const dollarMatch = lower.replace(/,/g, '').match(/\$?\s?(\d{3,6})/);
  if (kMatch) budgetLimit = Math.round(parseFloat(kMatch[1]) * 1000);
  else if (dollarMatch) budgetLimit = parseInt(dollarMatch[1], 10);

  // Nights
  let nights = 6;
  const nightMatch = lower.match(/(\d+)\s*(?:night|day)/);
  if (nightMatch) nights = parseInt(nightMatch[1], 10);

  // Travelers
  let travelers = 'Solo';
  if (lower.includes('couple') || lower.includes('two') || lower.includes('2 ')) travelers = '2 travelers';
  if (lower.includes('family')) travelers = 'Family';

  return {
    origin: 'JFK',
    ...city,
    budgetLimit,
    nights,
    travelers,
    dates: 'Flexible',
    vibe: prompt,
  };
}

// --- Claude-powered parse (when ANTHROPIC_API_KEY is set) ------------------

const SYSTEM = `You extract structured travel-search parameters from a user's free-text trip request.
Return ONLY a compact JSON object with keys:
origin (IATA, default "JFK"), destination (city name), country, destinationCode (IATA),
budgetLimit (integer USD, default 2000), nights (integer, default 6),
travelers (e.g. "Solo", "2 travelers"), dates (human string or "Flexible"), vibe (short phrase).
No prose, no markdown — JSON only.`;

async function parseIntentWithClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.SCOUT_MODEL || 'claude-haiku-4-5',
      max_tokens: 400,
      // Cache the system prompt — it's identical on every request.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '{}';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return { vibe: prompt, ...JSON.parse(json) };
}
