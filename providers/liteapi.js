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

const BASE = 'https://api.liteapi.travel/v3.0';

function KEY() {
  return process.env.LITEAPI_KEY || process.env.LITEAPI_SANDBOX_KEY || '';
}

function headers() {
  return { 'content-type': 'application/json', 'X-API-Key': KEY() };
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
  return { ids: Object.keys(byId).slice(0, 12), byId };
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
    if (!KEY()) return stubStays(intent);
    try {
      const place = await resolvePlace(intent);
      if (!place) return stubStays(intent);

      const { ids, byId } = await hotelIdsFor(place);
      if (!ids.length) return stubStays(intent);

      const rated = await ratesFor(ids, intent);
      if (!rated.length) return stubStays(intent);

      const nights = intent.nights || 5;
      const mapped = rated.map((entry) => {
        const id = entry.hotelId || entry.id;
        const meta = byId[id] || {};
        return {
          name: meta.name || entry.name || 'Hotel',
          area: meta.city || place.cityName,
          nightlyPrice: nightlyPriceOf(entry, nights),
          // Prefer the 1–5 star class; if absent, convert the 0–10 guest score
          // to a 5-point scale so the UI never shows e.g. "8.8★".
          rating: meta.stars > 0
            ? Number(meta.stars)
            : (meta.rating > 0 ? Math.round((meta.rating / 2) * 10) / 10 : 4),
          tag: 'LiteAPI',
          // In-app booking goes through LiteAPI's prebook/book flow (future);
          // for now leave bookingURL null so the UI doesn't show a dead link.
          bookingURL: null,
        };
      }).filter((s) => s.nightlyPrice > 0);

      mapped.sort((a, b) => a.nightlyPrice - b.nightlyPrice);
      return mapped.slice(0, 3).length ? mapped.slice(0, 3) : stubStays(intent);
    } catch (err) {
      console.warn('LiteAPI hotels failed:', err?.message || err);
      return stubStays(intent);
    }
  },
};
