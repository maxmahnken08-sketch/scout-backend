// Nearest airport, from a dataset that ships with the backend.
//
// This deliberately does not call a travel API. Airport positions are static —
// they don't change between requests, they don't need a token, and they can't
// rate-limit you or go down. An API here would add a network hop, a credential
// to keep alive and a failure mode, in exchange for data that hasn't moved in
// decades.
//
// Source: OurAirports (public domain), filtered to airports that have an IATA
// code and scheduled commercial service — 4,037 of them, worldwide. That drops
// heliports, private strips and closed fields, which are not places anyone is
// departing on a booked ticket.
//
// Replaces a hardcoded list of twenty US airports in the app, which had no
// distance ceiling and so answered "London" with "Boston".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

// Read once at boot. 269 KB parsed a single time, then held in memory — the
// lookup itself is a scan over an array, which at this size is well under a
// millisecond and not worth indexing.
const AIRPORTS = JSON.parse(
  readFileSync(path.join(here, '..', 'data', 'airports.json'), 'utf8'),
);

const EARTH_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/// Great-circle distance in km.
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

/// Airports near a coordinate, nearest first.
///
/// `limit` results within `maxKm`. Returning nothing when there's genuinely
/// nothing close is the point — the old behaviour always produced an answer,
/// which is how someone in London ended up departing from Boston. A caller that
/// gets an empty list should ask the user rather than guess.
///
/// Large hubs get a small handicap so that where a major airport and a regional
/// strip are comparably close, the one with flights to somewhere sorts first.
export function nearestAirports(lat, lon, { limit = 5, maxKm = 250 } = {}) {
  const scored = [];

  for (const a of AIRPORTS) {
    const km = haversine(lat, lon, a.y, a.x);
    if (km > maxKm) continue;
    // 25 km of credit for being a major hub — enough to win a close call,
    // not enough to beat an airport that is genuinely much nearer.
    scored.push({ a, km, rank: km - (a.b ? 25 : 0) });
  }

  scored.sort((p, q) => p.rank - q.rank);

  return scored.slice(0, limit).map(({ a, km }) => ({
    code: a.c,
    city: a.n,
    country: a.k,
    km: Math.round(km),
  }));
}

/// How many airports are loaded — surfaced on /health so a bad deploy that
/// shipped without the dataset is visible from outside instead of silently
/// returning nothing.
export function airportCount() {
  return AIRPORTS.length;
}
