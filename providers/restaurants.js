// Restaurants & trending spots — "Pepper". Top-rated eats + socially trending places.
//
// REAL INTEGRATION (when GOOGLE_PLACES_API_KEY or YELP_API_KEY is set):
//   Google Places: GET https://places.googleapis.com/v1/places:searchText
//     (textQuery: "best restaurants in {city}", rankPreference: RELEVANCE)
//   Yelp Fusion:   GET https://api.yelp.com/v3/businesses/search?location={city}&sort_by=rating
//   For "trending on social", layer a curated/Claude-ranked list on top.
// Map results -> the shape below; keep a maps/booking link.

export const restaurants = {
  name: 'Pepper',
  kind: 'restaurants',
  async search(intent) {
    const city = intent.destination || 'Tokyo';
    const maps = (q) => `https://www.google.com/maps/search/${encodeURIComponent(q + ' ' + city)}`;
    // TODO: replace stub with the live Places/Yelp call above.
    return [
      { name: `${city} Omakase Bar`,        cuisine: 'Sushi · downtown',  rating: 4.8, tag: 'Local favorite',     bookingURL: maps('best sushi') },
      { name: `${city} Street Eats Market`, cuisine: 'Street food',       rating: 4.6, tag: 'Trending on TikTok', bookingURL: maps('trending street food') },
      { name: `${city} Rooftop Kitchen`,    cuisine: 'Modern · views',    rating: 4.7, tag: 'Hot right now',      bookingURL: maps('rooftop restaurant') },
    ];
  },
};
