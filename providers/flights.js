import { searchAmadeus } from './amadeus.js';
import { searchDuffel } from './duffel.js';
import { searchTravelpayoutsFlights } from './travelpayouts.js';

// The flights provider. Tries the broadest source you have keys for, in order:
//   1. Amadeus      — Delta, American, JetBlue, United, ... (enterprise, gated)
//   2. Duffel       — American, JetBlue, many international (business signup)
//   3. Travelpayouts — affiliate prices incl. major airlines (free, indie-friendly)
//   4. Stub         — realistic sample data so the backend always runs keyless
export const flights = {
  name: 'Flights',
  kind: 'flights',
  async search(intent) {
    const amadeus = await safe(() => searchAmadeus(intent));
    if (amadeus.length) return amadeus;

    const duffel = await safe(() => searchDuffel(intent));
    if (duffel.length) return duffel;

    const tp = await safe(() => searchTravelpayoutsFlights(intent));
    if (tp.length) return tp;

    return stub(intent);
  },
};

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
