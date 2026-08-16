import { flights } from '../providers/flights.js';
import { liteapiStays } from '../providers/liteapi.js';
import { expedia } from '../providers/expedia.js';
import { booking } from '../providers/booking.js';
import { getyourguide } from '../providers/getyourguide.js';
import { viator } from '../providers/viator.js';
import { restaurants } from '../providers/restaurants.js';
import { tripadvisor } from '../providers/tripadvisor.js';
import { wikipediaActivities } from '../providers/wikipedia.js';
import { wikivoyageRestaurants } from '../providers/wikivoyage.js';

/**
 * The provider registry. THIS is how Scout pulls from "everywhere":
 * add a new legal travel source by importing it and dropping it in this array.
 * Nothing else in the app or backend changes.
 *
 * Each provider implements: { name, kind, async search(intent) -> [results] }
 *   kind ∈ 'flights' | 'stays' | 'activities' | 'ratings'
 */
export const providers = [
  flights,           // flights — Amadeus → Duffel → Travelpayouts → stub
  liteapiStays,      // stays — LiteAPI/Nuitée (Hotellook replacement; free sandbox key)
  expedia,           // stays — Expedia Rapid (keyless → [])
  booking,           // stays — Booking Demand (keyless → [])
  getyourguide,      // activities / experiences
  viator,            // activities / experiences (Tripadvisor company)
  restaurants,       // eats & trending spots (Pepper)
  tripadvisor,       // ratings & reviews
  wikipediaActivities, // activities — Wikipedia fallback (keyless; yields to Viator/GYG)
  wikivoyageRestaurants, // eats — Wikivoyage fallback (keyless; yields to Google Places)
];

/** Fan out to every provider of a given kind and merge their results. */
export async function searchKind(kind, intent) {
  const matching = providers.filter((p) => p.kind === kind);
  const settled = await Promise.allSettled(matching.map((p) => p.search(intent)));
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
