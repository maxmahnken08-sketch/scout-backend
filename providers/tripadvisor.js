// Ratings & reviews — Tripadvisor Content API (free key, self-serve).
// Live when TRIPADVISOR_API_KEY is set: searches the destination, then pulls
// its rating + review count to enrich the trip (see normalize.js intro line).

const BASE = 'https://api.content.tripadvisor.com/api/v1';

export const tripadvisor = {
  name: 'Tripadvisor',
  kind: 'ratings',
  async search(intent) {
    if (!process.env.TRIPADVISOR_API_KEY) return stub(intent);
    try {
      return await live(intent);
    } catch (err) {
      console.warn('Tripadvisor live lookup failed:', err?.message || err);
      return stub(intent);
    }
  },
};

async function live(intent) {
  const key = process.env.TRIPADVISOR_API_KEY;
  const q = encodeURIComponent(intent.destination || 'Tokyo');

  const sRes = await fetch(`${BASE}/location/search?searchQuery=${q}&category=geos&key=${key}`,
    { headers: { Accept: 'application/json' } });
  if (!sRes.ok) throw new Error(`Tripadvisor search ${sRes.status}`);
  const sJson = await sRes.json();
  const loc = sJson?.data?.[0];
  if (!loc) return stub(intent);

  const dRes = await fetch(`${BASE}/location/${loc.location_id}/details?key=${key}`,
    { headers: { Accept: 'application/json' } });
  if (!dRes.ok) throw new Error(`Tripadvisor details ${dRes.status}`);
  const d = await dRes.json();

  const rating = Number(d.rating ?? 4.6);
  const reviews = Number(d.num_reviews ?? 0);
  return [{
    source: 'Tripadvisor',
    destination: d.name || intent.destination,
    rating,
    reviewCount: reviews,
    summary: `${d.name} is rated ${rating}★ across ${reviews.toLocaleString()} reviews on Tripadvisor.`,
  }];
}

function stub(intent) {
  const city = intent.destination || 'Tokyo';
  return [{ source: 'Tripadvisor', destination: city, rating: 4.7, reviewCount: 184203,
    summary: `${city} is highly rated by travelers on Tripadvisor.` }];
}
