// Restaurants & trending spots — "Sage". Top-rated eats + popular places.
//
// REAL data via Google Places API (New) when GOOGLE_PLACES_API_KEY is set:
//   POST https://places.googleapis.com/v1/places:searchText
//   Header: X-Goog-Api-Key, X-Goog-FieldMask
// Falls back to a realistic stub when no key, so the backend always returns eats.

import { stubOr } from '../lib/stubs.js';

const KEY = () => process.env.GOOGLE_PLACES_API_KEY || '';

// Where this backend is reachable from the app. Places photo URLs must be
// proxied (see /img/place in server.js) because fetching one needs the API key.
const PUBLIC_BASE = () => (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

// Google hands back a photo *resource name*, not a URL. Turn it into a link to
// our own proxy. Without PUBLIC_BASE_URL set we return null rather than a
// relative path the app can't resolve.
function photoURL(place) {
  const ref = place?.photos?.[0]?.name;
  const base = PUBLIC_BASE();
  if (!ref || !base) return null;
  return `${base}/img/place?ref=${encodeURIComponent(ref)}&w=800`;
}

// Google priceLevel enum → $ signs.
const PRICE = {
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

function stub(city) {
  const maps = (q) => `https://www.google.com/maps/search/${encodeURIComponent(q + ' ' + city)}`;
  return [
    { name: `${city} Omakase Bar`,        cuisine: 'Sushi · downtown', rating: 4.8, tag: 'Local favorite',     bookingURL: maps('best sushi') },
    { name: `${city} Street Eats Market`, cuisine: 'Street food',      rating: 4.6, tag: 'Trending on TikTok', bookingURL: maps('trending street food') },
    { name: `${city} Rooftop Kitchen`,    cuisine: 'Modern · views',   rating: 4.7, tag: 'Hot right now',      bookingURL: maps('rooftop restaurant') },
  ];
}

export const restaurants = {
  name: 'Sage',
  kind: 'restaurants',
  async search(intent) {
    const city = intent.destination || 'Tokyo';
    if (!KEY()) return stubOr(stub(city));
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Goog-Api-Key': KEY(),
          'X-Goog-FieldMask': [
            'places.displayName', 'places.rating', 'places.userRatingCount',
            'places.priceLevel', 'places.primaryTypeDisplayName',
            'places.googleMapsUri', 'places.editorialSummary', 'places.photos',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: `best restaurants in ${city}`,
          maxResultCount: 12,
        }),
      });
      if (!res.ok) throw new Error(`Google Places ${res.status}`);
      const json = await res.json();
      const places = (json.places || [])
        .filter((p) => (p.userRatingCount || 0) >= 50 && p.rating)
        // Rank by a blend of rating + review volume so well-loved spots win.
        .sort((a, b) =>
          (b.rating * Math.log10((b.userRatingCount || 1) + 10)) -
          (a.rating * Math.log10((a.userRatingCount || 1) + 10)))
        .slice(0, 4);
      if (!places.length) return stubOr(stub(city));

      return places.map((p, i) => {
        const type = p.primaryTypeDisplayName?.text || 'Restaurant';
        const price = PRICE[p.priceLevel] || '';
        const reviews = p.userRatingCount || 0;
        return {
          name: p.displayName?.text || 'Restaurant',
          cuisine: [type, price].filter(Boolean).join(' · '),
          rating: Number(p.rating) || 4.5,
          tag: i === 0 ? 'Top rated'
            : reviews > 1000 ? 'Crowd favorite'
            : 'Highly rated',
          bookingURL: p.googleMapsUri || null,
          imageURL: photoURL(p),
        };
      });
    } catch (err) {
      console.warn('Google Places restaurants failed:', err?.message || err);
      return stubOr(stub(city));
    }
  },
};
