import { flights } from '../providers/flights.js';
import { travelpayoutsStays } from '../providers/travelpayouts.js';
import { expedia } from '../providers/expedia.js';
import { booking } from '../providers/booking.js';
import { getyourguide } from '../providers/getyourguide.js';
import { viator } from '../providers/viator.js';
import { tripadvisor } from '../providers/tripadvisor.js';

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
  travelpayoutsStays, // stays — Travelpayouts/Hotellook (free, indie-friendly)
  expedia,           // stays — Expedia Rapid (keyless → [])
  booking,           // stays — Booking Demand (keyless → [])
  getyourguide,      // activities / experiences
  viator,            // activities / experiences (Tripadvisor company)
  tripadvisor,       // ratings & reviews
];

/** Fan out to every provider of a given kind and merge their results. */
export async function searchKind(kind, intent) {
  const matching = providers.filter((p) => p.kind === kind);
  const settled = await Promise.allSettled(matching.map((p) => p.search(intent)));
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
