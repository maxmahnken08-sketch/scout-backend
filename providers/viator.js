// Activities — Viator Partner API (Tripadvisor company). Live when VIATOR_API_KEY is set.
// NOTE: Viator's product search takes a numeric destination id, not a city name.
// Resolve city -> destinationId once via GET /partner/destinations (cache it) and
// attach it to intent.viatorDestId. Without it we fall back to the stub.

const SEARCH = 'https://api.viator.com/partner/products/search';
const DESTINATIONS = 'https://api.viator.com/partner/destinations';

// Cache the (large) destination taxonomy in memory after the first fetch so we
// can map a city name → Viator's numeric destinationId on demand.
let destCache = null;
async function resolveDestId(city) {
  if (!city) return null;
  try {
    if (!destCache) {
      const res = await fetch(DESTINATIONS, {
        headers: {
          'exp-api-key': process.env.VIATOR_API_KEY,
          Accept: 'application/json;version=2.0',
          'Accept-Language': 'en-US',
        },
      });
      if (!res.ok) throw new Error(`Viator destinations ${res.status}`);
      destCache = (await res.json()).destinations || [];
    }
    const want = city.toLowerCase();
    // Prefer an exact city/name match, else the first partial match.
    const exact = destCache.find((d) => (d.name || '').toLowerCase() === want);
    const partial = exact || destCache.find((d) => (d.name || '').toLowerCase().includes(want));
    return partial?.destinationId ?? partial?.ref ?? null;
  } catch (err) {
    console.warn('Viator destination resolve failed:', err?.message || err);
    return null;
  }
}

export const viator = {
  name: 'Viator',
  kind: 'activities',
  async search(intent) {
    if (!process.env.VIATOR_API_KEY) return stub(intent);
    try {
      const destId = intent.viatorDestId || await resolveDestId(intent.destination);
      if (!destId) return stub(intent);
      return await live({ ...intent, viatorDestId: destId });
    } catch (err) {
      console.warn('Viator live search failed:', err?.message || err);
      return stub(intent);
    }
  },
};

async function live(intent) {
  const res = await fetch(SEARCH, {
    method: 'POST',
    headers: {
      'exp-api-key': process.env.VIATOR_API_KEY,
      Accept: 'application/json;version=2.0',
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US',
    },
    body: JSON.stringify({
      filtering: { destination: String(intent.viatorDestId) },
      pagination: { start: 1, count: 5 },
      currency: 'USD',
    }),
  });
  if (!res.ok) throw new Error(`Viator ${res.status}`);
  const json = await res.json();
  return (json.products ?? []).slice(0, 3).map((p) => ({
    name: p.title,
    provider: 'Viator',
    durationText: p.duration?.fixedDurationInMinutes
      ? `${Math.round(p.duration.fixedDurationInMinutes / 60)}h`
      : 'Flexible',
    price: Math.round(p.pricing?.summary?.fromPrice ?? 0),
    rating: Number(p.reviews?.combinedAverageRating ?? 4.6),
    bookingURL: p.productUrl || 'https://www.viator.com',
  }));
}

function stub(intent) {
  const city = intent.destination || 'Tokyo';
  return [
    { name: `${city} day trip`,           provider: 'Viator', durationText: 'Full day', price: 88, rating: 4.7, bookingURL: 'https://www.viator.com' },
    { name: `${city} skip-the-line pass`, provider: 'Viator', durationText: 'Flexible', price: 39, rating: 4.6, bookingURL: 'https://www.viator.com' },
  ];
}
