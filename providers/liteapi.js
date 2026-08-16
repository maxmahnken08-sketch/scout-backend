// Hotels via LiteAPI (Nuitée) — the modern, indie-friendly hotel API that
// replaces the shut-down Hotellook. Free sandbox key (no card), real hotel
// content + rates, monetizes via markup on production bookings.
//
// Docs: https://docs.liteapi.travel  •  Auth header: X-API-Key
// Sandbox base works with a sandbox key; production base with a production key.
//
// Flow: resolve the destination → a set of hotel IDs (static data), then ask
// for live rates for those IDs over the trip dates. We map the cheapest few
// into Scout's `stays` shape. Falls back to a realistic stub when unkeyed or
// on any error, so the backend always returns something.

import { stubOr } from '../lib/stubs.js';

const BASE = 'https://api.liteapi.travel/v3.0';

function KEY() {
  return process.env.LITEAPI_KEY || process.env.LITEAPI_SANDBOX_KEY || '';
}

function headers() {
  return { 'content-type': 'application/json', 'X-API-Key': KEY() };
}

// Booking.com affiliate "Book" deep-link: opens Booking.com pre-filled with the
// hotel + dates, carrying the affiliate id so a booking earns commission.
// Works without the id (just no commission) — set BOOKING_AID on Render to monetize.
function BOOKING_AID() { return process.env.BOOKING_AID || ''; }
function bookingDeepLink(name, city, checkin, checkout) {
  const params = [
    `ss=${encodeURIComponent(`${name}, ${city}`)}`,
    checkin ? `checkin=${checkin}` : '',
    checkout ? `checkout=${checkout}` : '',
    'group_adults=2', 'no_rooms=1', 'group_children=0',
    BOOKING_AID() ? `aid=${BOOKING_AID()}` : '',
  ].filter(Boolean).join('&');
  return `https://www.booking.com/searchresults.html?${params}`;
}

function daysFromNow(n) {
  // Date.now() is unavailable in some sandboxes; backend runs in Node so it's fine here.
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

// Minimal country-name → ISO-3166 alpha-2 map for the destinations Scout knows.
// Anything not here falls back to a free-text place lookup.
const COUNTRY_CODES = {
  'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB', england: 'GB',
  france: 'FR', spain: 'ES', portugal: 'PT', italy: 'IT', greece: 'GR', germany: 'DE',
  netherlands: 'NL', 'czech republic': 'CZ', czechia: 'CZ', austria: 'AT', hungary: 'HU',
  ireland: 'IE', switzerland: 'CH', iceland: 'IS', croatia: 'HR', turkey: 'TR',
  morocco: 'MA', 'south africa': 'ZA', egypt: 'EG', kenya: 'KE', uae: 'AE',
  'united arab emirates': 'AE', japan: 'JP', 'south korea': 'KR', china: 'CN',
  thailand: 'TH', vietnam: 'VN', indonesia: 'ID', india: 'IN', singapore: 'SG',
  australia: 'AU', 'new zealand': 'NZ', mexico: 'MX', brazil: 'BR', argentina: 'AR',
  peru: 'PE', canada: 'CA', colombia: 'CO', 'costa rica': 'CR',
};

// Resolve a {cityName, countryCode} for the LiteAPI static-data lookup.
async function resolvePlace(intent) {
  const city = intent.destination || '';
  const countryName = (intent.country || '').toLowerCase().trim();
  if (COUNTRY_CODES[countryName]) {
    return { cityName: city, countryCode: COUNTRY_CODES[countryName] };
  }
  // Fall back to LiteAPI's place search to discover the country code.
  try {
    const url = `${BASE}/data/places?textSearch=${encodeURIComponent(city)}`;
    const res = await fetch(url, { headers: headers() });
    if (res.ok) {
      const json = await res.json();
      const first = (json.data || json.places || [])[0];
      const cc = first?.countryCode || first?.country_code || first?.address?.countryCode;
      if (cc) return { cityName: city, countryCode: cc };
    }
  } catch { /* ignore, fall through to stub */ }
  return null;
}

async function hotelIdsFor(place) {
  const url = `${BASE}/data/hotels?countryCode=${encodeURIComponent(place.countryCode)}` +
              `&cityName=${encodeURIComponent(place.cityName)}&limit=15`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`LiteAPI data/hotels ${res.status}`);
  const json = await res.json();
  const list = json.data || json.hotels || [];
  // keep a name+stars lookup so we can enrich rate results
  const byId = {};
  for (const h of list) byId[h.id || h.hotelId] = h;
  return { ids: Object.keys(byId).slice(0, 40), byId };
}

// Recognizable hotel brands, so we can guarantee mainstream options appear
// (not just the cheapest independents).
const CHAINS = [
  'Marriott', 'Hilton', 'Hyatt', 'Holiday Inn', 'Hampton', 'Sheraton', 'Westin',
  'DoubleTree', 'Courtyard', 'Ritz', 'Four Seasons', 'Wyndham', 'Best Western',
  'Crowne', 'InterContinental', 'Renaissance', 'Aloft', 'Embassy', 'Kimpton',
  'Conrad', 'Waldorf', 'Le Meridien', 'Sofitel', 'Novotel', 'Radisson',
  'Fairmont', 'St. Regis', 'JW Marriott', 'Moxy', 'Residence Inn', 'Fairfield',
];
function chainOf(name) {
  const lower = (name || '').toLowerCase();
  return CHAINS.find((c) => lower.includes(c.toLowerCase())) || null;
}

// LiteAPI static hotel data carries supplier photography, and displaying it is
// part of the API terms. Field naming varies across their responses, so try the
// documented shapes in order and fall back to null (the app draws its gradient).
function imageOf(meta) {
  if (!meta) return null;
  const candidate =
    meta.main_photo ||
    meta.mainPhoto ||
    meta.thumbnail ||
    meta.hotelImages?.[0]?.urlHd ||
    meta.hotelImages?.[0]?.url ||
    meta.images?.[0]?.url ||
    (typeof meta.images?.[0] === 'string' ? meta.images[0] : null);
  return httpsOrNull(candidate);
}

// Only hand the app https URLs — ATS blocks plain http, and a bad value would
// silently render as a broken image instead of the gradient fallback.
export function httpsOrNull(url) {
  if (typeof url !== 'string' || !url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice(7)}`;
  return trimmed.startsWith('https://') ? trimmed : null;
}

// Choose a diverse, useful set: a budget pick + recognizable mainstream chains
// (cheapest per distinct brand) + fill with next-cheapest. Keeps users in
// familiar territory instead of only obscure cheapest options.
function pickDiverse(mapped, limit) {
  const byPrice = [...mapped].sort((a, b) => a.nightlyPrice - b.nightlyPrice);
  const chosen = [];
  const seen = new Set();
  const usedChain = new Set();
  const add = (h) => { if (h && !seen.has(h.name)) { seen.add(h.name); chosen.push(h); } };

  add(byPrice[0]); // a cheapest option
  for (const h of byPrice) { // recognizable chains, cheapest per brand
    if (chosen.length >= limit) break;
    const c = chainOf(h.name);
    if (c && !usedChain.has(c)) { usedChain.add(c); add(h); }
  }
  for (const h of byPrice) { if (chosen.length >= limit) break; add(h); } // fill
  return chosen.sort((a, b) => a.nightlyPrice - b.nightlyPrice).slice(0, limit);
}

async function ratesFor(ids, intent) {
  const body = {
    hotelIds: ids,
    checkin: intent.checkin || daysFromNow(30),
    checkout: intent.checkout || daysFromNow(30 + (intent.nights || 5)),
    occupancies: [{ adults: 2 }],
    currency: 'USD',
    guestNationality: 'US',
  };
  const res = await fetch(`${BASE}/hotels/rates`, {
    method: 'POST', headers: headers(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LiteAPI hotels/rates ${res.status}`);
  const json = await res.json();
  return json.data || json.hotels || [];
}

// Pull a nightly USD price out of LiteAPI's (nested) rate structure, defensively.
function nightlyPriceOf(rateEntry, nights) {
  const r =
    rateEntry?.roomTypes?.[0]?.rates?.[0] ||
    rateEntry?.rates?.[0] ||
    rateEntry?.roomTypes?.[0] || {};
  const total =
    r?.retailRate?.total?.[0]?.amount ??
    r?.retailRate?.total?.amount ??
    r?.price ?? r?.amount ?? 0;
  const n = Math.max(1, nights || 5);
  return Math.round(Number(total) / (Number(total) > 0 ? n : 1)) || Math.round(Number(total));
}

function stubStays(intent) {
  const city = intent.destination || 'the city';
  return [
    { name: `${city} Central Hotel`, area: 'City center', nightlyPrice: 132, rating: 4.4, tag: 'Top rated', bookingURL: null },
    { name: `${city} Boutique Stay`, area: 'Old town', nightlyPrice: 158, rating: 4.6, tag: 'Boutique', bookingURL: null },
    { name: `${city} Riverside Suites`, area: 'Waterfront', nightlyPrice: 189, rating: 4.7, tag: 'Great view', bookingURL: null },
  ];
}

// Diagnostic: run the pipeline WITHOUT the stub fallback so callers see the
// real failure point + message. Used by the /debug/stays route.
export async function debugStays(intent) {
  const k = KEY();
  // Safe fingerprint: prefix + length + last 4 — enough to compare, never the full secret.
  const fingerprint = k ? `${k.slice(0, 5)}…${k.slice(-4)} (len ${k.length}, ws:${/\s/.test(k)})` : 'none';
  const out = { key: !!k, fingerprint, steps: {} };
  try {
    const place = await resolvePlace(intent);
    out.steps.resolvePlace = place;
    if (!place) { out.error = 'resolvePlace returned null'; return out; }

    const { ids, byId } = await hotelIdsFor(place);
    out.steps.hotelIds = ids;
    if (!ids.length) { out.error = 'no hotel ids'; return out; }

    const rated = await ratesFor(ids, intent);
    out.steps.ratedCount = rated.length;
    out.steps.sampleEntryKeys = rated[0] ? Object.keys(rated[0]) : null;
    out.steps.firstNightly = rated[0] ? nightlyPriceOf(rated[0], intent.nights || 5) : null;
  } catch (err) {
    out.error = String(err?.message || err);
  }
  return out;
}

export const liteapiStays = {
  name: 'LiteAPI',
  kind: 'stays',
  async search(intent) {
    if (!KEY()) return stubOr(stubStays(intent));
    try {
      const place = await resolvePlace(intent);
      if (!place) return stubOr(stubStays(intent));

      const { ids, byId } = await hotelIdsFor(place);
      if (!ids.length) return stubOr(stubStays(intent));

      const rated = await ratesFor(ids, intent);
      if (!rated.length) return stubOr(stubStays(intent));

      const nights = intent.nights || 5;
      const mapped = rated.map((entry) => {
        const id = entry.hotelId || entry.id;
        const meta = byId[id] || {};
        const name = meta.name || entry.name || 'Hotel';
        const brand = chainOf(name);
        return {
          name,
          hotelId: id, // small id; lets the app re-fetch a fresh offer at book time
          area: meta.city || place.cityName,
          nightlyPrice: nightlyPriceOf(entry, nights),
          // Prefer the 1–5 star class; if absent, convert the 0–10 guest score
          // to a 5-point scale so the UI never shows e.g. "8.8★".
          rating: meta.stars > 0
            ? Number(meta.stars)
            : (meta.rating > 0 ? Math.round((meta.rating / 2) * 10) / 10 : 4),
          // Label recognizable brands so users see familiar names highlighted.
          tag: brand || (meta.stars >= 5 ? 'Luxury' : 'Great value'),
          // Supplier photography — null when LiteAPI has none for this hotel.
          imageURL: imageOf(meta),
          // "Book" → Booking.com affiliate deep-link (commission via BOOKING_AID).
          bookingURL: bookingDeepLink(name, meta.city || place.cityName,
                                      intent.checkin, intent.checkout),
        };
      }).filter((s) => s.nightlyPrice > 0);

      // Surface a diverse mix (budget + mainstream chains), up to 6.
      const picked = pickDiverse(mapped, 6);
      return picked.length ? picked : stubOr(stubStays(intent));
    } catch (err) {
      console.warn('LiteAPI hotels failed:', err?.message || err);
      return stubOr(stubStays(intent));
    }
  },
};

// ---- Booking flow (prebook → pay via LiteAPI Stripe SDK → book) ------------
// LiteAPI rate offers are large and short-lived, so we DON'T ship offerIds in
// /plan. Instead, at book time the app sends {hotelId, checkin, checkout} and we
// fetch a FRESH offer, then prebook it.

// LiteAPI responses can contain raw control chars (in terms text) that break
// strict JSON.parse — sanitize before parsing.
async function liteJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return JSON.parse(text.replace(/[ -]+/g, ' ')); }
}

// Get the current cheapest offer for one hotel over the given dates.
export async function freshOffer({ hotelId, checkin, checkout, adults = 2 }) {
  if (!KEY()) throw new Error('LITEAPI_KEY not set');
  const body = {
    hotelIds: [hotelId],
    checkin, checkout,
    occupancies: [{ adults: Number(adults) || 2 }],
    currency: 'USD', guestNationality: 'US',
  };
  const res = await fetch(`${BASE}/hotels/rates`, {
    method: 'POST', headers: headers(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LiteAPI rates ${res.status}`);
  const json = await liteJson(res);
  const entry = (json.data || [])[0];
  const rate = entry?.roomTypes?.[0]?.rates?.[0];
  const offerId = entry?.roomTypes?.[0]?.offerId;
  if (!offerId) throw new Error('no offer available for these dates');
  return {
    offerId,
    name: rate?.name || 'Room',
    boardName: rate?.boardName || null,
    total: rate?.retailRate?.total?.[0]?.amount ?? null,
    currency: rate?.retailRate?.total?.[0]?.currency ?? 'USD',
    cancellationPolicies: rate?.cancellationPolicies ?? null,
  };
}

// Confirm the live price + set up payment. usePaymentSdk:true returns a Stripe
// client secret (secretKey) + transactionId the app uses to collect payment.
export async function prebook(offerId) {
  if (!KEY()) throw new Error('LITEAPI_KEY not set');
  const res = await fetch(`${BASE}/rates/prebook`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ offerId, usePaymentSdk: true }),
  });
  if (!res.ok) throw new Error(`LiteAPI prebook ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await liteJson(res);
  const d = json.data || json;
  return {
    prebookId: d.prebookId,
    transactionId: d.transactionId,
    secretKey: d.secretKey,          // Stripe PaymentIntent client secret
    price: d.price,
    currency: d.currency,
    sellingPrice: d.sellingPriceToUser ?? d.price,
    cancellationPolicies: d.cancellationPolicies ?? null,
    termsAndConditions: d.termsAndConditions ?? null,
  };
}

// Finalize the booking after payment is confirmed via the SDK (transactionId).
export async function book({ prebookId, transactionId, holder, guests }) {
  if (!KEY()) throw new Error('LITEAPI_KEY not set');
  const res = await fetch(`${BASE}/rates/book`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      prebookId,
      holder,                                   // {firstName,lastName,email}
      payment: { method: 'TRANSACTION_ID', transactionId },
      guests,                                   // [{occupancyNumber,firstName,lastName,email}]
    }),
  });
  if (!res.ok) throw new Error(`LiteAPI book ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await liteJson(res);
  const d = json.data || json;
  return {
    bookingId: d.bookingId,
    status: d.status,
    confirmation: d.supplierBookingId || d.hotelConfirmationCode || d.bookingId,
    hotelName: d.hotel?.name || d.hotelName || null,
    checkin: d.checkin, checkout: d.checkout,
  };
}
