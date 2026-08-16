// Attractions from Wikipedia — the keyless activities source.
//
// Viator and GetYourGuide both need partner approval, so without this the
// experiences section is simply empty. Wikipedia's geosearch needs no key, runs
// on infrastructure that actually stays up (unlike the public Overpass API,
// which returned 504s and empty 200s under the same load), and gives us real
// places with real photographs.
//
// What it does NOT give: prices, ratings, or bookability. Those come back null
// rather than invented. When VIATOR_API_KEY appears this provider stands down
// and the real bookable inventory takes over.
//
// Content © Wikipedia contributors, CC BY-SA.

const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'ScoutTravel/1.0 (+https://scouttravel.app; maxmahnken08@gmail.com)';

const hasBookableProvider = () =>
  !!(process.env.VIATOR_API_KEY || process.env.GETYOURGUIDE_TOKEN);

const TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map();
const cached = (k) => {
  const h = cache.get(k);
  return h && Date.now() - h.at < TTL_MS ? h.value : null;
};
const remember = (k, v) => {
  cache.set(k, { at: Date.now(), value: v });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return v;
};

// Geocode via Wikipedia itself, so this provider has exactly one dependency.
async function cityCoords(city) {
  const key = `geo:${city.toLowerCase()}`;
  const hit = cached(key);
  if (hit !== null) return hit;
  const url = `${API}?action=query&format=json&prop=coordinates&titles=${encodeURIComponent(city)}&redirects=1`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikipedia geo ${res.status}`);
  const json = await res.json();
  const page = Object.values(json?.query?.pages || {})[0];
  const c = page?.coordinates?.[0];
  return remember(key, c ? { lat: c.lat, lon: c.lon } : null);
}

// Geosearch returns everything near a point — metro stations, banks, courts.
// These decide what a traveller would actually go and see.
const WANTED = /\b(museum|cathedral|basilica|church|monastery|convent|castle|palace|fort|tower|monument|memorial|square|plaza|park|garden|bridge|aqueduct|viewpoint|miradouro|beach|ruins|temple|shrine|gallery|theatre|theater|opera|market|zoo|aquarium|observatory|lighthouse|abbey|chapel)\b/i;
const UNWANTED = /\b(metro station|railway station|train station|bus station|secret police|bank|embassy|court|university|hospital|school|prison|headquarters|company|football club|newspaper|airport)\b/i;

function isAttraction(page) {
  const text = `${page.title} ${page.description || ''}`;
  if (UNWANTED.test(text)) return false;
  return WANTED.test(text);
}

export const wikipediaActivities = {
  name: 'Wikipedia',
  kind: 'activities',
  async search(intent) {
    if (hasBookableProvider()) return [];
    const city = intent.destination;
    if (!city) return [];
    const key = `act:${city.toLowerCase()}`;
    const hit = cached(key);
    if (hit) return hit;

    try {
      const at = await cityCoords(city);
      if (!at) return [];
      const url = `${API}?action=query&format=json&generator=geosearch` +
        `&ggscoord=${at.lat}%7C${at.lon}&ggsradius=10000&ggslimit=100` +
        `&prop=pageimages%7Cdescription&piprop=thumbnail&pithumbsize=800&pilimit=100`;
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`Wikipedia geosearch ${res.status}`);
      const json = await res.json();
      const pages = Object.values(json?.query?.pages || {});

      const mapped = pages
        .filter(isAttraction)
        // A page image is a decent proxy for "somewhere worth looking at", and
        // it means the card renders with a real photograph.
        .sort((a, b) => (b.thumbnail ? 1 : 0) - (a.thumbnail ? 1 : 0))
        .slice(0, 4)
        .map((p) => ({
          name: p.title,
          provider: 'Wikipedia',
          durationText: p.description || 'Point of interest',
          price: null,   // not bookable here — never invent a price
          rating: null,  // Wikipedia has no ratings
          bookingURL: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
          imageURL: p.thumbnail?.source || null,
        }));

      return remember(key, mapped);
    } catch (err) {
      console.warn('Wikipedia activities failed:', err?.message || err);
      return [];
    }
  },
};
