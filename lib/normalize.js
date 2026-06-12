import { searchKind } from './registry.js';
import { parseIntent } from './intent.js';
import { flightDeal } from '../providers/travelpayouts.js';

function daysFromNow(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * The orchestrator. Parses intent, fans out to every provider, merges the
 * results, and returns the exact JSON contract the Scout iOS app expects
 * (matches PlanResponseDTO in LiveTripDataSource.swift).
 */
export async function planTrip(prompt, opts = {}) {
  const intent = await parseIntent(prompt);
  // Honor the user's home airport (from onboarding) as the flight origin.
  if (opts.origin && /^[A-Za-z]{3}$/.test(opts.origin)) {
    intent.origin = opts.origin.toUpperCase();
  }

  const [flights, stays, activities, ratings, restaurants, deal] = await Promise.all([
    searchKind('flights', intent),
    searchKind('stays', intent),
    searchKind('activities', intent),
    searchKind('ratings', intent),
    searchKind('restaurants', intent),
    flightDeal(intent), // gentle "cheaper nearby date" suggestion, or null
  ]);

  // Cheapest flight wins the "Best" badge.
  flights.sort((a, b) => a.price - b.price);
  if (flights[0]) flights[0].isBest = true;
  // The user's preferred airline floats to the top (cheapest keeps the badge).
  if (opts.airline) {
    const pref = String(opts.airline).toLowerCase();
    flights.sort((a, b) =>
      (b.airline?.toLowerCase().includes(pref) ? 1 : 0) -
      (a.airline?.toLowerCase().includes(pref) ? 1 : 0));
  }
  stays.sort((a, b) => a.nightlyPrice - b.nightlyPrice);
  activities.sort((a, b) => b.rating - a.rating);

  // Attach "book on the site you trust" menus (same pattern as flights).
  attachLinkMenus({ stays, activities, restaurants }, intent);

  const nights = intent.nights || 6;
  // Explicit budget (e.g. the draggable budget bar) beats whatever was parsed.
  const budgetLimit = Number(opts.budget) > 0 ? Math.round(Number(opts.budget)) : (intent.budgetLimit || 2000);
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
      // Machine-readable dates for booking (fall back to ~30 days out).
      checkin: intent.checkin || daysFromNow(30),
      checkout: intent.checkout || daysFromNow(30 + nights),
      // Gentle Hopper-style tip when a nearby date is cheaper (null = show nothing).
      dealNote: deal?.note || null,
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
      // Ground transport — trains (region-aware) and car rentals, deep-linked.
      transit: transitLinks(intent),
      carRentals: carRentalLinks(intent),
    },
  };
}

// --- Ground transport links -------------------------------------------------
const EUROPE = new Set(['Portugal','Spain','France','Italy','Germany','Netherlands','Belgium','Austria',
  'Switzerland','UK','United Kingdom','England','Ireland','Greece','Czech Republic','Poland','Hungary',
  'Croatia','Denmark','Sweden','Norway','Finland','Iceland']);
const SOUTH_AMERICA = new Set(['Brazil','Argentina','Chile','Peru','Colombia','Ecuador','Bolivia',
  'Uruguay','Paraguay','Venezuela']);

function transitLinks(intent) {
  const q = (s) => encodeURIComponent(s);
  const city = intent.destination || '';
  const country = intent.country || '';
  const from = intent.origin || 'JFK';
  const links = [
    // Rome2Rio shows every way to get there/around: train, bus, ferry, drive.
    { site: 'Rome2Rio', url: `https://www.rome2rio.com/s/${q(from)}/${q(city)}` },
  ];
  if (EUROPE.has(country)) {
    links.push(
      { site: 'Trainline', url: `https://www.thetrainline.com/` },
      { site: 'Eurostar', url: `https://www.eurostar.com/` },
      { site: 'Omio · trains & buses', url: `https://www.omio.com/` },
      { site: 'Rail Europe', url: `https://www.raileurope.com/` },
      { site: 'FlixBus', url: `https://www.flixbus.com/` },
    );
  } else if (SOUTH_AMERICA.has(country)) {
    // Trains are rare in South America — buses are the main intercity network.
    links.push(
      { site: 'Busbud · buses', url: `https://www.busbud.com/en` },
      { site: 'FlixBus', url: `https://www.flixbus.com/` },
    );
  } else if (country === 'Japan') {
    links.push({ site: 'Japan Rail Pass', url: 'https://www.jrailpass.com/' });
  } else if (country === 'USA' || country === 'Canada') {
    links.push(
      { site: 'Amtrak', url: 'https://www.amtrak.com/' },
      { site: 'Busbud · buses', url: `https://www.busbud.com/en` },
      { site: 'FlixBus', url: `https://www.flixbus.com/` },
    );
  } else if (country === 'Mexico') {
    links.push({ site: 'Busbud · buses', url: `https://www.busbud.com/en` });
  }
  return links;
}

function carRentalLinks(intent) {
  const q = (s) => encodeURIComponent(s);
  const city = intent.destination || '';
  const d1 = intent.checkin, d2 = intent.checkout;
  return [
    { site: 'Kayak', url: `https://www.kayak.com/cars/${q(city)}${d1 && d2 ? `/${d1}/${d2}` : ''}` },
    { site: 'Expedia', url: `https://www.expedia.com/carsearch?locn=${q(city)}${d1 ? `&date1=${d1}` : ''}${d2 ? `&date2=${d2}` : ''}` },
    { site: 'Priceline', url: `https://www.priceline.com/drive/search/r/${q(city)}` },
    { site: 'Turo', url: `https://turo.com/us/en/search?location=${q(city)}${d1 ? `&startDate=${d1}` : ''}${d2 ? `&endDate=${d2}` : ''}` },
  ];
}

// --- Multi-source booking menus --------------------------------------------
// Every stay/activity/restaurant gets deep links to several well-known sites,
// prefilled with the place + city (+ dates for hotels), so users compare and
// book wherever they're comfortable. Booking.com carries the affiliate id.
function attachLinkMenus({ stays, activities, restaurants }, intent) {
  const city = intent.destination || '';
  const checkin = intent.checkin;
  const checkout = intent.checkout;
  const aid = process.env.BOOKING_AID || '';
  const q = (s) => encodeURIComponent(s);

  for (const s of stays) {
    if (s.bookingOptions) continue;
    const place = `${s.name} ${city}`;
    const dates = checkin && checkout ? `&checkin=${checkin}&checkout=${checkout}` : '';
    const eDates = checkin && checkout ? `&startDate=${checkin}&endDate=${checkout}` : '';
    s.bookingOptions = [
      { site: 'Booking.com', url: `https://www.booking.com/searchresults.html?ss=${q(place)}${dates}${aid ? `&aid=${aid}` : ''}` },
      { site: 'Expedia', url: `https://www.expedia.com/Hotel-Search?destination=${q(place)}${eDates}&adults=2` },
      { site: 'Hotels.com', url: `https://www.hotels.com/Hotel-Search?destination=${q(place)}${eDates}&adults=2` },
      { site: 'Google Hotels', url: `https://www.google.com/travel/search?q=${q(place)}` },
      { site: 'Tripadvisor', url: `https://www.tripadvisor.com/Search?q=${q(place)}` },
    ];
  }

  for (const a of activities) {
    if (a.bookingOptions) continue;
    const what = `${a.name} ${city}`;
    a.bookingOptions = [
      { site: 'GetYourGuide', url: `https://www.getyourguide.com/s/?q=${q(what)}` },
      { site: 'Viator', url: `https://www.viator.com/searchResults/all?text=${q(what)}` },
      { site: 'Tripadvisor', url: `https://www.tripadvisor.com/Search?q=${q(what)}` },
    ];
    if (!a.bookingURL) a.bookingURL = a.bookingOptions[0].url;
  }

  for (const r of restaurants) {
    if (r.bookingOptions) continue;
    const where = `${r.name} ${city}`;
    r.bookingOptions = [
      { site: 'Google Maps', url: r.bookingURL || `https://www.google.com/maps/search/${q(where)}` },
      { site: 'Tripadvisor', url: `https://www.tripadvisor.com/Search?q=${q(where)}` },
      { site: 'Yelp', url: `https://www.yelp.com/search?find_desc=${q(r.name)}&find_loc=${q(city)}` },
      { site: 'OpenTable', url: `https://www.opentable.com/s?term=${q(r.name)}&queryUnderstandingType=default` },
    ];
    if (!r.bookingURL) r.bookingURL = r.bookingOptions[0].url;
  }
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
