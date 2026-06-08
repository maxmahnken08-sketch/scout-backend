// Turns a free-text trip request into structured search parameters.
// Uses Claude (Haiku) when ANTHROPIC_API_KEY is set; falls back to a heuristic
// parser so the backend runs with zero keys for local development.

// Cities + countries → a representative city with an IATA city code.
// Keys are matched case-insensitively on word boundaries.
const CITY_DB = {
  tokyo: { destination: 'Tokyo', country: 'Japan', destinationCode: 'TYO' },
  japan: { destination: 'Tokyo', country: 'Japan', destinationCode: 'TYO' },
  kyoto: { destination: 'Kyoto', country: 'Japan', destinationCode: 'KIX' },
  osaka: { destination: 'Osaka', country: 'Japan', destinationCode: 'OSA' },
  lisbon: { destination: 'Lisbon', country: 'Portugal', destinationCode: 'LIS' },
  porto: { destination: 'Porto', country: 'Portugal', destinationCode: 'OPO' },
  portugal: { destination: 'Lisbon', country: 'Portugal', destinationCode: 'LIS' },
  paris: { destination: 'Paris', country: 'France', destinationCode: 'PAR' },
  france: { destination: 'Paris', country: 'France', destinationCode: 'PAR' },
  nice: { destination: 'Nice', country: 'France', destinationCode: 'NCE' },
  london: { destination: 'London', country: 'UK', destinationCode: 'LON' },
  england: { destination: 'London', country: 'UK', destinationCode: 'LON' },
  edinburgh: { destination: 'Edinburgh', country: 'UK', destinationCode: 'EDI' },
  ireland: { destination: 'Dublin', country: 'Ireland', destinationCode: 'DUB' },
  dublin: { destination: 'Dublin', country: 'Ireland', destinationCode: 'DUB' },
  rome: { destination: 'Rome', country: 'Italy', destinationCode: 'ROM' },
  italy: { destination: 'Rome', country: 'Italy', destinationCode: 'ROM' },
  milan: { destination: 'Milan', country: 'Italy', destinationCode: 'MIL' },
  venice: { destination: 'Venice', country: 'Italy', destinationCode: 'VCE' },
  florence: { destination: 'Florence', country: 'Italy', destinationCode: 'FLR' },
  barcelona: { destination: 'Barcelona', country: 'Spain', destinationCode: 'BCN' },
  madrid: { destination: 'Madrid', country: 'Spain', destinationCode: 'MAD' },
  spain: { destination: 'Barcelona', country: 'Spain', destinationCode: 'BCN' },
  amsterdam: { destination: 'Amsterdam', country: 'Netherlands', destinationCode: 'AMS' },
  berlin: { destination: 'Berlin', country: 'Germany', destinationCode: 'BER' },
  germany: { destination: 'Berlin', country: 'Germany', destinationCode: 'BER' },
  munich: { destination: 'Munich', country: 'Germany', destinationCode: 'MUC' },
  vienna: { destination: 'Vienna', country: 'Austria', destinationCode: 'VIE' },
  prague: { destination: 'Prague', country: 'Czechia', destinationCode: 'PRG' },
  athens: { destination: 'Athens', country: 'Greece', destinationCode: 'ATH' },
  greece: { destination: 'Athens', country: 'Greece', destinationCode: 'ATH' },
  santorini: { destination: 'Santorini', country: 'Greece', destinationCode: 'JTR' },
  istanbul: { destination: 'Istanbul', country: 'Türkiye', destinationCode: 'IST' },
  dubai: { destination: 'Dubai', country: 'UAE', destinationCode: 'DXB' },
  bali: { destination: 'Bali', country: 'Indonesia', destinationCode: 'DPS' },
  bangkok: { destination: 'Bangkok', country: 'Thailand', destinationCode: 'BKK' },
  thailand: { destination: 'Bangkok', country: 'Thailand', destinationCode: 'BKK' },
  phuket: { destination: 'Phuket', country: 'Thailand', destinationCode: 'HKT' },
  singapore: { destination: 'Singapore', country: 'Singapore', destinationCode: 'SIN' },
  seoul: { destination: 'Seoul', country: 'South Korea', destinationCode: 'SEL' },
  'hong kong': { destination: 'Hong Kong', country: 'China', destinationCode: 'HKG' },
  vietnam: { destination: 'Hanoi', country: 'Vietnam', destinationCode: 'HAN' },
  sydney: { destination: 'Sydney', country: 'Australia', destinationCode: 'SYD' },
  australia: { destination: 'Sydney', country: 'Australia', destinationCode: 'SYD' },
  baja: { destination: 'Baja Sur', country: 'Mexico', destinationCode: 'SJD' },
  cancun: { destination: 'Cancún', country: 'Mexico', destinationCode: 'CUN' },
  'cabo': { destination: 'Los Cabos', country: 'Mexico', destinationCode: 'SJD' },
  mexico: { destination: 'Mexico City', country: 'Mexico', destinationCode: 'MEX' },
  iceland: { destination: 'Reykjavik', country: 'Iceland', destinationCode: 'KEF' },
  reykjavik: { destination: 'Reykjavik', country: 'Iceland', destinationCode: 'KEF' },
  hawaii: { destination: 'Honolulu', country: 'USA', destinationCode: 'HNL' },
  'new york': { destination: 'New York', country: 'USA', destinationCode: 'NYC' },
  'los angeles': { destination: 'Los Angeles', country: 'USA', destinationCode: 'LAX' },
  vegas: { destination: 'Las Vegas', country: 'USA', destinationCode: 'LAS' },
  'las vegas': { destination: 'Las Vegas', country: 'USA', destinationCode: 'LAS' },
  miami: { destination: 'Miami', country: 'USA', destinationCode: 'MIA' },
  'new orleans': { destination: 'New Orleans', country: 'USA', destinationCode: 'MSY' },
  'san francisco': { destination: 'San Francisco', country: 'USA', destinationCode: 'SFO' },
  chicago: { destination: 'Chicago', country: 'USA', destinationCode: 'CHI' },
  'costa rica': { destination: 'San José', country: 'Costa Rica', destinationCode: 'SJO' },
  morocco: { destination: 'Marrakesh', country: 'Morocco', destinationCode: 'RAK' },
  marrakesh: { destination: 'Marrakesh', country: 'Morocco', destinationCode: 'RAK' },
  'cape town': { destination: 'Cape Town', country: 'South Africa', destinationCode: 'CPT' },
  rio: { destination: 'Rio de Janeiro', country: 'Brazil', destinationCode: 'GIG' },
  brazil: { destination: 'Rio de Janeiro', country: 'Brazil', destinationCode: 'GIG' },
};

const STOPWORDS = new Set(['a', 'an', 'the', 'to', 'in', 'into', 'for', 'my', 'me', 'trip', 'plan',
  'planning', 'go', 'going', 'visit', 'visiting', 'vacation', 'holiday', 'week', 'weeks', 'weekend',
  'days', 'day', 'nights', 'night', 'under', 'over', 'budget', 'around', 'near', 'find', 'show',
  'i', 'want', 'wanna', 'need', 'please', 'best', 'cheap', 'cheapest', 'solo', 'couple', 'family',
  'with', 'and', 'on', 'this', 'that', 'place', 'places', 'somewhere', 'anywhere', 'things', 'do',
  'eat', 'eats', 'stay', 'stays', 'flights', 'hotels', 'about', 'some', 'next', 'get', 'take',
  'tickets', 'where', 'should', 'us', 'we', 'lets', "let's", 'a', 'at', 'see', 'explore']);

function titleCase(s) {
  return s.replace(/\s+/g, ' ').trim().split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function dropStopwords(phrase) {
  return phrase.split(/\s+/).filter(w => w && !STOPWORDS.has(w.toLowerCase())).join(' ').trim();
}

// Best-effort destination extraction when the city isn't in CITY_DB, so we
// reflect what the user typed instead of defaulting to a fixed city.
function extractDestination(prompt) {
  // 1) "...to / in / visit <Place>" — capture up to 3 words.
  const prep = prompt.match(/\b(?:to|in|into|visit|visiting|explore|see|around|near|at)\s+([A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*){0,2})/i);
  if (prep) {
    const cleaned = dropStopwords(prep[1]);
    if (cleaned) return titleCase(cleaned);
  }
  // 2) A capitalized proper-noun run (e.g. "Santorini trip").
  const proper = prompt.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/);
  if (proper) {
    const cleaned = dropStopwords(proper[1]);
    if (cleaned) return titleCase(cleaned);
  }
  // 3) Longest remaining non-stopword token.
  const tokens = prompt.toLowerCase().replace(/[^a-z\s'’\-]/g, ' ').split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t));
  if (tokens.length) { tokens.sort((a, b) => b.length - a.length); return titleCase(tokens[0]); }
  return null;
}

export async function parseIntent(prompt) {
  let intent;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      intent = await parseIntentWithClaude(prompt);
    } catch (err) {
      console.warn('Claude intent parse failed, using heuristic:', err?.message || err);
    }
  }
  if (!intent) intent = heuristicIntent(prompt);

  // Always derive concrete travel dates from the text (deterministic — code
  // knows today's date, which Claude does not). This drives the flight month
  // and hotel check-in/out so results match what the user actually asked for.
  const dates = deriveDates(prompt, intent.nights || 6);
  if (dates) {
    intent.departureDate = dates.departureDate;
    intent.returnDate = dates.returnDate;
    intent.checkin = dates.checkin;
    intent.checkout = dates.checkout;
    intent.dates = dates.label;
  }
  return intent;
}

// --- Date parsing: "mid September", "Dec 12", "in 2 weeks", "next month" ----

const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n) { return String(n).padStart(2, '0'); }
function isoDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function prettyRange(a, b) {
  const sameYear = a.getFullYear() === b.getFullYear();
  const start = `${MONTH_SHORT[a.getMonth()]} ${a.getDate()}`;
  const end = `${MONTH_SHORT[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
  return sameYear ? `${start} – ${end}` : `${start}, ${a.getFullYear()} – ${end}`;
}

function deriveDates(prompt, nights) {
  const lower = prompt.toLowerCase();
  const now = new Date();
  let depart = null;

  // 1) Month name, optionally with mid/early/late or an explicit day.
  const monthRe = new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\b`);
  const m = lower.match(monthRe);
  if (m) {
    const monthIdx = MONTHS[m[1]];
    let day = 15; // default to mid-month
    if (/\b(early|beginning|start)\b/.test(lower)) day = 5;
    else if (/\b(late|end)\b/.test(lower)) day = 25;
    else if (/\bmid\b/.test(lower)) day = 15;
    // explicit day adjacent to the month, e.g. "September 12" or "12th of September"
    const dayMatch = lower.match(
      new RegExp(`(?:${m[1]}\\s+(\\d{1,2})|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${m[1]})`)
    );
    if (dayMatch) day = parseInt(dayMatch[1] || dayMatch[2], 10);
    let year = now.getFullYear();
    if (new Date(year, monthIdx, day) < now) year += 1; // month already passed → next year
    depart = new Date(year, monthIdx, Math.min(Math.max(day, 1), 28));
  }

  // 2) Relative phrasing.
  if (!depart) {
    const wk = lower.match(/in\s+(\d+)\s+weeks?/);
    const dy = lower.match(/in\s+(\d+)\s+days?/);
    if (wk) depart = addDays(now, parseInt(wk[1], 10) * 7);
    else if (dy) depart = addDays(now, parseInt(dy[1], 10));
    else if (/\bnext month\b/.test(lower)) depart = addDays(now, 30);
    else if (/\bnext week\b/.test(lower)) depart = addDays(now, 7);
    else if (/\bthis weekend\b/.test(lower)) { depart = addDays(now, (6 - now.getDay() + 7) % 7 || 7); }
    else if (/\btomorrow\b/.test(lower)) depart = addDays(now, 1);
  }

  if (!depart) return null; // no date cues → keep defaults (flights ~30 days out)

  const back = addDays(depart, Math.max(1, nights || 6));
  return {
    departureDate: isoDate(depart),
    returnDate: isoDate(back),
    checkin: isoDate(depart),
    checkout: isoDate(back),
    label: prettyRange(depart, back),
  };
}

// --- Heuristic fallback (no API key needed) -------------------------------

function heuristicIntent(prompt) {
  const lower = prompt.toLowerCase();

  let city = null;
  // Match known cities/countries on word boundaries, longest key first.
  for (const key of Object.keys(CITY_DB).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`);
    if (re.test(lower)) { city = CITY_DB[key]; break; }
  }
  // Unknown city → use the destination the user typed (no IATA, so flights fall back
  // to placeholders, but the trip reflects their search — never silently "Tokyo").
  if (!city) {
    const name = extractDestination(prompt);
    city = { destination: name || 'Anywhere', country: '', destinationCode: null };
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
