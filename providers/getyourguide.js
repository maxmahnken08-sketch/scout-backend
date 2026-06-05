// Activities — GetYourGuide Partner API. Live when GETYOURGUIDE_TOKEN is set.
// NOTE: GYG field names vary by API version/contract — verify mapping against
// your partner account's sample response, then adjust the map() below.

const API = 'https://api.getyourguide.com/1/tours';

export const getyourguide = {
  name: 'GetYourGuide',
  kind: 'activities',
  async search(intent) {
    if (!process.env.GETYOURGUIDE_TOKEN) return stub(intent);
    try {
      return await live(intent);
    } catch (err) {
      console.warn('GetYourGuide live search failed:', err?.message || err);
      return stub(intent);
    }
  },
};

async function live(intent) {
  const q = encodeURIComponent(intent.destination || 'Tokyo');
  const res = await fetch(`${API}?q=${q}&cnt_language=en&currency=USD&limit=5`, {
    headers: { 'X-ACCESS-TOKEN': process.env.GETYOURGUIDE_TOKEN, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GetYourGuide ${res.status}`);
  const json = await res.json();
  const tours = json?.data?.tours ?? [];
  return tours.slice(0, 3).map((t) => ({
    name: t.title,
    provider: 'GetYourGuide',
    durationText: t.durations?.[0]?.duration || 'Flexible',
    price: Math.round(t.price?.values?.amount ?? t.price?.amount ?? 0),
    rating: Number(t.overall_rating ?? t.rating ?? 4.6),
    bookingURL: t.url || 'https://www.getyourguide.com',
  }));
}

function stub(intent) {
  const city = intent.destination || 'Tokyo';
  return [
    { name: `${city} food & culture walk`, provider: 'GetYourGuide', durationText: '3 hours',  price: 92, rating: 4.8, bookingURL: 'https://www.getyourguide.com' },
    { name: `${city} highlights tour`,     provider: 'GetYourGuide', durationText: 'Half day', price: 65, rating: 4.7, bookingURL: 'https://www.getyourguide.com' },
  ];
}
