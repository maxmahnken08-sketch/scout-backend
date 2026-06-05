// Flights via Amadeus (GDS) — broadest US carrier coverage:
// Delta, American, JetBlue, United, Alaska, etc.
//
// Live when AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET are set; otherwise [].
// Test host shown below; switch to api.amadeus.com for production credentials.

const HOST = process.env.AMADEUS_HOST || 'https://test.api.amadeus.com';

export async function searchAmadeus(intent) {
  if (!process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET) return [];
  try {
    const token = await getToken();
    return await search(intent, token);
  } catch (err) {
    console.warn('Amadeus live search failed:', err?.message || err);
    return [];
  }
}

async function getToken() {
  const res = await fetch(`${HOST}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_CLIENT_ID,
      client_secret: process.env.AMADEUS_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Amadeus auth ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

async function search(intent, token) {
  const origin = intent.origin || 'JFK';
  const dest = intent.destinationCode || 'NRT';
  const departure = intent.departureDate || daysFromNow(30);

  const params = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: dest,
    departureDate: departure,
    adults: '1',
    currencyCode: 'USD',
    max: '8',
  });

  const res = await fetch(`${HOST}/v2/shopping/flight-offers?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Amadeus offers ${res.status}`);

  const json = await res.json();
  const carriers = json?.dictionaries?.carriers || {};
  return (json.data || [])
    .map((offer) => mapOffer(offer, carriers))
    .filter(Boolean)
    .sort((a, b) => a.price - b.price)
    .slice(0, 4);
}

function mapOffer(offer, carriers) {
  const itin = offer?.itineraries?.[0];
  const segments = itin?.segments ?? [];
  if (!segments.length) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const stops = segments.length - 1;
  const code = offer.validatingAirlineCodes?.[0] || first.carrierCode;

  return {
    airline: carriers[code] ? titleCase(carriers[code]) : code,
    route: `${first.departure?.iataCode} → ${last.arrival?.iataCode}`,
    duration: isoDurationToText(itin.duration),
    stops: stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`,
    price: Math.round(parseFloat(offer.price?.total)),
    bookingURL: 'https://www.amadeus.com', // replace with your booking/checkout deep link
  };
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

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
