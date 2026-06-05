// Flights provider — Duffel (aggregates many airlines via NDC + GDS).
//
// Live when DUFFEL_TOKEN is set; otherwise returns realistic stub data so the
// backend still runs with zero keys. Swap to Amadeus/Kiwi here for broader
// low-cost-carrier coverage — nothing else in Scout changes.

const DUFFEL_API = 'https://api.duffel.com/air/offer_requests?return_offers=true';

// Returns flight results, or [] when no token is set / on error.
// The flights selector (providers/flights.js) decides the fallback order.
export async function searchDuffel(intent) {
  if (!process.env.DUFFEL_TOKEN) return [];
  const origin = intent.origin || 'JFK';
  const dest = intent.destinationCode || 'NRT';
  try {
    return await live(intent, origin, dest);
  } catch (err) {
    console.warn('Duffel live search failed:', err?.message || err);
    return [];
  }
}

// --- Live Duffel call ------------------------------------------------------

async function live(intent, origin, dest) {
  const departure = intent.departureDate || daysFromNow(30);
  const ret = intent.returnDate || daysFromNow(30 + (intent.nights || 6));

  const body = {
    data: {
      cabin_class: 'economy',
      passengers: [{ type: 'adult' }],
      slices: [
        { origin, destination: dest, departure_date: departure },
        { origin: dest, destination: origin, departure_date: ret },
      ],
    },
  };

  const res = await fetch(DUFFEL_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DUFFEL_TOKEN}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Duffel ${res.status}`);

  const json = await res.json();
  const offers = json?.data?.offers ?? [];

  return offers
    .map(mapOffer)
    .filter(Boolean)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);
}

function mapOffer(offer) {
  const outbound = offer?.slices?.[0];
  const segments = outbound?.segments ?? [];
  if (!segments.length) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const stops = segments.length - 1;

  return {
    airline: offer.owner?.name || segments[0]?.marketing_carrier?.name || 'Airline',
    route: `${first.origin?.iata_code} → ${last.destination?.iata_code}`,
    duration: isoDurationToText(outbound.duration),
    stops: stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`,
    price: Math.round(parseFloat(offer.total_amount)),
    bookingURL: 'https://www.duffel.com', // replace with your booking/checkout deep link
  };
}

// "PT14H5M" -> "14h 05m"
function isoDurationToText(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return '';
  const h = m[1] ? `${m[1]}h` : '';
  const min = m[2] ? `${String(m[2]).padStart(2, '0')}m` : '';
  return [h, min].filter(Boolean).join(' ');
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
