// Attractions & restaurants from OpenStreetMap — the keyless fallback.
//
// Viator, GetYourGuide and Google Places all require partner approval or a
// billing account. Until one of those is connected, these two categories would
// otherwise be empty. OSM has no signup at all and the places are real, so Ivy
// and Sage can do genuine work today.
//
// What OSM does NOT have: prices, ratings, or photos. Those come back null
// rather than invented — the whole point of removing the stubs was to stop
// showing users numbers we made up.
//
// Data © OpenStreetMap contributors, ODbL. Attribution is required wherever
// these results are displayed.
//
// Usage policy: Nominatim asks for ≤1 request/second and a identifying
// User-Agent; Overpass asks for moderate use. Both are cached hard below. At
// real traffic this should move to a proper provider or a self-hosted instance.

import { httpsOrNull } from './liteapi.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'ScoutTravel/1.0 (+https://scouttravel.app)';

// These only run when nothing better is connected, so results never duplicate.
const hasActivityProvider = () =>
  !!(process.env.VIATOR_API_KEY || process.env.GETYOURGUIDE_TOKEN);
const hasRestaurantProvider = () => !!process.env.GOOGLE_PLACES_API_KEY;

// --- caching -----------------------------------------------------------------
// City geometry never really changes and POI sets change slowly, so a long TTL
// keeps us well inside both services' usage policies.
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map();

function cached(key) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > TTL_MS) return null;
  return hit.value;
}
function remember(key, value) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return value;
}

async function geocode(city) {
  const key = `geo:${city.toLowerCase()}`;
  const hit = cached(key);
  if (hit !== null) return hit;
  const url = `${NOMINATIM}?city=${encodeURIComponent(city)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = await res.json();
  const first = json?.[0];
  if (!first) return remember(key, null);
  return remember(key, { lat: Number(first.lat), lon: Number(first.lon) });
}

async function overpass(query) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  return json?.elements || [];
}

function mapsLink(name, city) {
  return `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${city}`)}`;
}

/** Prefer a real website; fall back to a maps search so the row is still useful. */
function linkFor(tags, name, city) {
  return httpsOrNull(tags?.website || tags?.['contact:website']) || mapsLink(name, city);
}

/** Rank by how much the mapper bothered to fill in — a decent proxy for notability. */
function completeness(tags = {}) {
  const signals = ['website', 'wikidata', 'wikipedia', 'opening_hours', 'phone', 'description'];
  return signals.reduce((n, k) => n + (tags[k] ? 1 : 0), 0);
}

function dedupeByName(list) {
  const seen = new Set();
  return list.filter((x) => {
    const k = (x.name || '').toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// --- activities --------------------------------------------------------------

const ACTIVITY_LABEL = {
  museum: 'Museum', attraction: 'Attraction', viewpoint: 'Viewpoint',
  gallery: 'Gallery', artwork: 'Public art', zoo: 'Zoo', aquarium: 'Aquarium',
  castle: 'Castle', monument: 'Monument', ruins: 'Historic ruins',
  memorial: 'Memorial', fort: 'Fort', palace: 'Palace',
};

function labelFor(tags) {
  return ACTIVITY_LABEL[tags.tourism] || ACTIVITY_LABEL[tags.historic] || 'Place to visit';
}

export const osmActivities = {
  name: 'OpenStreetMap',
  kind: 'activities',
  async search(intent) {
    if (hasActivityProvider()) return []; // a real partner is connected
    const city = intent.destination;
    if (!city) return [];
    const key = `act:${city.toLowerCase()}`;
    const hit = cached(key);
    if (hit) return hit;
    try {
      const place = await geocode(city);
      if (!place) return [];
      const q = `[out:json][timeout:25];(` +
        `node["tourism"="museum"]["name"](around:7000,${place.lat},${place.lon});` +
        `node["tourism"="attraction"]["name"](around:7000,${place.lat},${place.lon});` +
        `node["tourism"="viewpoint"]["name"](around:7000,${place.lat},${place.lon});` +
        `node["historic"="castle"]["name"](around:9000,${place.lat},${place.lon});` +
        `);out body 80;`;
      const elements = await overpass(q);
      const mapped = dedupeByName(elements.map((e) => {
        const t = e.tags || {};
        return {
          name: t.name,
          provider: 'OpenStreetMap',
          durationText: labelFor(t),
          price: null,            // OSM has no pricing — never invent one
          rating: null,           // nor ratings
          bookingURL: linkFor(t, t.name, city),
          _score: completeness(t),
        };
      }))
        .sort((a, b) => b._score - a._score)
        .slice(0, 4)
        .map(({ _score, ...rest }) => rest);
      return remember(key, mapped);
    } catch (err) {
      console.warn('OSM activities failed:', err?.message || err);
      return [];
    }
  },
};

// --- restaurants -------------------------------------------------------------

function cuisineLabel(tags) {
  const raw = (tags.cuisine || '').split(';')[0].replace(/_/g, ' ').trim();
  const kind = tags.amenity === 'cafe' ? 'Cafe'
    : tags.amenity === 'bar' ? 'Bar'
    : 'Restaurant';
  if (!raw) return kind;
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)} · ${kind.toLowerCase()}`;
}

export const osmRestaurants = {
  name: 'OpenStreetMap',
  kind: 'restaurants',
  async search(intent) {
    if (hasRestaurantProvider()) return [];
    const city = intent.destination;
    if (!city) return [];
    const key = `eat:${city.toLowerCase()}`;
    const hit = cached(key);
    if (hit) return hit;
    try {
      const place = await geocode(city);
      if (!place) return [];
      // Require a cuisine tag — it both improves the copy and filters out the
      // long tail of barely-mapped entries.
      const q = `[out:json][timeout:25];(` +
        `node["amenity"="restaurant"]["name"]["cuisine"](around:4000,${place.lat},${place.lon});` +
        `);out body 120;`;
      const elements = await overpass(q);
      const mapped = dedupeByName(elements.map((e) => {
        const t = e.tags || {};
        return {
          name: t.name,
          cuisine: cuisineLabel(t),
          rating: null,           // OSM has no ratings
          tag: 'On the map',      // honest: it's a listing, not a recommendation
          bookingURL: linkFor(t, t.name, city),
          _score: completeness(t),
        };
      }))
        .sort((a, b) => b._score - a._score)
        .slice(0, 4)
        .map(({ _score, ...rest }) => rest);
      return remember(key, mapped);
    } catch (err) {
      console.warn('OSM restaurants failed:', err?.message || err);
      return [];
    }
  },
};
