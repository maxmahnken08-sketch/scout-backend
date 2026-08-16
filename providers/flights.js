import { searchAmadeus } from './amadeus.js';
import { searchDuffel } from './duffel.js';
import { searchTravelpayoutsFlights, bookingOptions } from './travelpayouts.js';
import { stubOr } from '../lib/stubs.js';

// The flights provider. Tries the broadest source you have keys for, in order:
//   1. Amadeus      — Delta, American, JetBlue, United, ... (enterprise, gated)
//   2. Duffel       — American, JetBlue, many international (business signup)
//   3. Travelpayouts — affiliate prices incl. major airlines (free, indie-friendly)
//   4. Stub         — sample data, OFF unless SCOUT_ALLOW_STUBS=1. Invented
//                     airfares are the most dangerous fake data in the app:
//                     someone could budget a trip around a price that isn't real.
export const flights = {
  name: 'Flights',
  kind: 'flights',
  async search(intent) {
    const amadeus = await safe(() => searchAmadeus(intent));
    if (amadeus.length) return withBookingMenu(amadeus, intent);

    const duffel = await safe(() => searchDuffel(intent));
    if (duffel.length) return withBookingMenu(duffel, intent);

    const tp = await safe(() => searchTravelpayoutsFlights(intent));
    if (tp.length) return withBookingMenu(tp, intent);

    return withBookingMenu(stubOr(stub(intent)), intent);
  },
};

// Attach the multi-source booking menu (Expedia, Google Flights, Kayak,
// Skyscanner, Priceline, +Aviasales when affiliate link exists) to every
// flight, whichever provider it came from. Primary link = Expedia.
function withBookingMenu(results, intent) {
  const origin = intent.origin || 'JFK';
  const dest = intent.destinationCode;
  const depart = intent.departureDate;
  if (!dest || !depart) return results; // can't build deep links without route+date
  return results.map((f) => {
    if (f.bookingOptions) return f;
    const aviasales = /aviasales/.test(f.bookingURL || '') ? f.bookingURL : null;
    const options = bookingOptions(origin, dest, depart, intent.checkout || null, aviasales);
    return { ...f, bookingURL: options[0].url, bookingOptions: options };
  });
}

async function safe(fn) {
  try {
    return (await fn()) ?? [];
  } catch {
    return [];
  }
}

function stub(intent) {
  const origin = intent.origin || 'JFK';
  const dest = intent.destinationCode || intent.destination || 'NRT';
  return [
    { airline: 'Delta',             route: `${origin} → ${dest}`, duration: '14h 10m', stops: 'Nonstop', price: 910, bookingURL: 'https://www.delta.com' },
    { airline: 'JetBlue',           route: `${origin} → ${dest}`, duration: '15h 40m', stops: '1 stop',  price: 720, bookingURL: 'https://www.jetblue.com' },
    { airline: 'American Airlines', route: `${origin} → ${dest}`, duration: '16h 05m', stops: '1 stop',  price: 815, bookingURL: 'https://www.aa.com' },
  ];
}
