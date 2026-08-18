// Flight status — is this a real flight, and when does it actually leave?
//
// The app used to take a flight number as free text and never look at it. You
// could type "banana" and get the same three reminders, all computed from a
// date you picked yourself. This is the lookup that makes the number mean
// something.
//
// AeroDataBox via RapidAPI: flight status by number and date, a free tier that
// covers a small app, and a plain REST shape. Live when AERODATABOX_KEY is set;
// otherwise every call returns null and the app falls back to reminders built
// from the user's own date, which is exactly what it does today.

const HOST = 'aerodatabox.p.rapidapi.com';

/// AeroDataBox returns "2026-08-19 07:20Z" — a space where ISO 8601 wants a T,
/// and no seconds. Swift's ISO8601DateFormatter rejects it outright, so every
/// reminder would have silently fallen back to the time the user guessed. Fixed
/// here rather than in the app so there's one place that knows this quirk.
function iso(raw) {
  if (!raw) return null;
  const normalised = String(raw).trim().replace(' ', 'T');
  const withSeconds = /T\d{2}:\d{2}Z?$/.test(normalised)
    ? normalised.replace(/Z?$/, ':00Z')
    : normalised;
  const d = new Date(withSeconds);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function hasFlightStatus() {
  return !!process.env.AERODATABOX_KEY;
}

/// One flight, on one date.
///
/// `number` is an IATA/ICAO designator like "TP204" or "BA2490". `date` is
/// YYYY-MM-DD, local to departure.
///
/// Returns null when unkeyed, when the flight doesn't exist, or on any error —
/// the caller treats all three the same way: don't claim to know something.
export async function flightStatus(number, date) {
  if (!hasFlightStatus()) return null;

  const clean = String(number).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{2,3}\d{1,4}$/.test(clean)) return null;

  try {
    const url = `https://${HOST}/flights/number/${clean}/${date}` +
      `?withAircraftImage=false&withLocation=false`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': process.env.AERODATABOX_KEY,
        'X-RapidAPI-Host': HOST,
      },
    });
    // 204 is their "no such flight that day", which is a real answer, not a fault.
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw new Error(`AeroDataBox ${res.status}`);

    const body = await res.json();
    const leg = Array.isArray(body) ? body[0] : body;
    if (!leg) return null;

    const dep = leg.departure ?? {};
    const arr = leg.arrival ?? {};

    // Scheduled is what the airline published; revised is what it's actually
    // doing now. Prefer revised — that difference is the entire point.
    const scheduled = iso(dep.scheduledTime?.utc);
    const revised = iso(dep.revisedTime?.utc ?? dep.predictedTime?.utc);
    if (!scheduled && !revised) return null;

    return {
      number: leg.number ?? clean,
      airline: leg.airline?.name ?? '',
      status: leg.status ?? 'Unknown',
      origin: dep.airport?.iata ?? '',
      originName: dep.airport?.municipalityName ?? dep.airport?.name ?? '',
      destination: arr.airport?.iata ?? '',
      destinationName: arr.airport?.municipalityName ?? arr.airport?.name ?? '',
      // ISO 8601 UTC. The app schedules against these.
      scheduledDeparture: scheduled,
      actualDeparture: revised,
      scheduledArrival: iso(arr.scheduledTime?.utc),
      terminal: dep.terminal ?? '',
      gate: dep.gate ?? '',
      // True when the airline has moved it. The app uses this to decide whether
      // to say "your flight moved" rather than silently rescheduling.
      changed: !!(scheduled && revised && scheduled !== revised),
    };
  } catch (err) {
    console.warn('Flight status lookup failed:', err?.message || err);
    return null;
  }
}
