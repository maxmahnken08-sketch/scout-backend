import { searchKind } from './registry.js';
import { parseIntent } from './intent.js';

/**
 * The orchestrator. Parses intent, fans out to every provider, merges the
 * results, and returns the exact JSON contract the Scout iOS app expects
 * (matches PlanResponseDTO in LiveTripDataSource.swift).
 */
export async function planTrip(prompt) {
  const intent = await parseIntent(prompt);

  const [flights, stays, activities, ratings, restaurants] = await Promise.all([
    searchKind('flights', intent),
    searchKind('stays', intent),
    searchKind('activities', intent),
    searchKind('ratings', intent),
    searchKind('restaurants', intent),
  ]);

  // Cheapest flight wins the "Best" badge.
  flights.sort((a, b) => a.price - b.price);
  if (flights[0]) flights[0].isBest = true;
  stays.sort((a, b) => a.nightlyPrice - b.nightlyPrice);
  activities.sort((a, b) => b.rating - a.rating);

  const nights = intent.nights || 6;
  const budgetLimit = intent.budgetLimit || 2000;
  const bestFlight = flights[0]?.price || 0;
  const stayNightly = stays[0]?.nightlyPrice || 0;
  const estimatedTotal = Math.round(bestFlight + stayNightly * nights);

  const ta = ratings[0];
  const ratingNote = ta ? ` (${ta.rating}★ on Tripadvisor)` : '';
  const underOver = estimatedTotal <= budgetLimit ? 'under' : 'around';
  const intro =
    `Here's a ${nights}-night ${intent.destination}${ratingNote} trip — flights compared across ` +
    `all airlines, stays from Expedia & Booking, and experiences from GetYourGuide & Viator — ` +
    `${underOver} your $${budgetLimit} budget.`;

  return {
    intro,
    followUp: 'Want me to adjust the budget, swap stays, or add more experiences?',
    trip: {
      destination: intent.destination,
      country: intent.country || '',
      dates: intent.dates || 'Flexible',
      nights,
      travelers: intent.travelers || 'Solo',
      vibe: prompt,
      status: 'Planned',
      budgetLimit,
      estimatedTotal,
      flights,
      stays,
      days: buildDays(intent, activities),
      activities,
      restaurants,
    },
  };
}

// A lightweight day-plan builder. In production, hand `activities` + `intent`
// to Claude here to write a richer narrative itinerary.
function buildDays(intent, activities) {
  const city = intent.destination;
  const picks = activities.map((a) => a.name);
  return [
    { day: 1, title: `Arrive in ${city}`, items: ['Settle in & drop bags', 'Sunset neighborhood walk', 'Local dinner nearby'] },
    { day: 2, title: 'Highlights & food', items: [picks[0] || 'Morning landmark', 'Coffee & wander', picks[1] || 'Evening food spot'] },
    { day: 3, title: 'Go deeper', items: [picks[2] || 'Half-day experience', 'Markets & side streets', 'Last great meal'] },
  ];
}
