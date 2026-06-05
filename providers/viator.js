// Activities — Viator Partner API (Tripadvisor company). Live when VIATOR_API_KEY is set.
// NOTE: Viator's product search takes a numeric destination id, not a city name.
// Resolve city -> destinationId once via GET /partner/destinations (cache it) and
// attach it to intent.viatorDestId. Without it we fall back to the stub.

const SEARCH = 'https://api.viator.com/partner/products/search';

export const viator = {
  name: 'Viator',
  kind: 'activities',
  async search(intent) {
    if (!process.env.VIATOR_API_KEY || !intent.viatorDestId) return stub(intent);
    try {
      return await live(intent);
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
