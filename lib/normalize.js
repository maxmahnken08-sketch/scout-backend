import { searchKind } from './registry.js';
import { parseIntent } from './intent.js';
import { flightDeal } from '../providers/travelpayouts.js';
import { destinationPhoto } from '../providers/photos.js';

/** "$1,397, under your $2,000." */
function money(total, budget) {
  const t = `$${total.toLocaleString()}`, b = `$${budget.toLocaleString()}`;
  return total <= budget ? `${t}, under your ${b}.` : `${t}, a bit over your ${b}.`;
}

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
  // Progress reporting. `opts.onPhase(phase, state, detail)` is called as each
  // stage actually settles, so the app's planning screen shows real work rather
  // than a timer pretending to be one. No-op when nobody's listening.
  const emit = typeof opts.onPhase === 'function' ? opts.onPhase : () => {};

  emit('intent', 'active');
  const intent = await parseIntent(prompt);
  // Honor the user's home airport (from onboarding) as the flight origin.
  if (opts.origin && /^[A-Za-z]{3}$/.test(opts.origin)) {
    intent.origin = opts.origin.toUpperCase();
  }
  emit('intent', 'done', {
    destination: intent.destination,
    nights: intent.nights || 6,
    detail: `${intent.nights || 6} nights in ${intent.destination}`,
  });

  // Each phase resolves independently and reports the moment it lands — the
  // fan-out still runs concurrently, so nothing is slower for the sake of the UI.
  const track = (phase, promise, describe) => {
    emit(phase, 'active');
    return promise.then(
      (value) => { emit(phase, 'done', describe(value)); return value; },
      (err) => { emit(phase, 'failed', { error: String(err?.message || err) }); return []; },
    );
  };

  // Each phase reports a one-line headline as well as a count, so the waiting
  // screen fills in with what was actually found rather than ticking off
  // abstractions. Cheapest-first, because that's the number people want.
  const cheapest = (list, key) =>
    list.length ? Math.min(...list.map((x) => Number(x[key]) || Infinity)) : null;
  const money = (n) => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : null);

  const [flights, stays, activities, ratings, restaurants, deal] = await Promise.all([
    track('flights', searchKind('flights', intent), (v) => {
      const low = money(cheapest(v, 'price'));
      return { count: v.length, detail: low ? `from ${low} return` : null };
    }),
    track('stays', searchKind('stays', intent), (v) => {
      const low = money(cheapest(v, 'nightlyPrice'));
      return { count: v.length, detail: low ? `from ${low} a night` : null };
    }),
    track('activities', searchKind('activities', intent), (v) => ({
      count: v.length,
      detail: v[0]?.name || null,
    })),
    searchKind('ratings', intent).catch(() => []),
    track('eats', searchKind('restaurants', intent), (v) => ({
      count: v.length,
      detail: v[0]?.name || null,
    })),
    flightDeal(intent).catch(() => null), // gentle "cheaper nearby date" suggestion, or null
  ]);

  // Fetched after the fan-out rather than inside it: a missing photo shouldn't
  // hold up a plan, and it's cached for a day so it's usually free anyway.
  const photo = await destinationPhoto(intent.destination, intent.country).catch(() => null);

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

  emit('days', 'active');

  const nights = intent.nights || 6;
  // Explicit budget (e.g. the draggable budget bar) beats whatever was parsed.
  const budgetLimit = Number(opts.budget) > 0 ? Math.round(Number(opts.budget)) : (intent.budgetLimit || 2000);
  const bestFlight = flights[0]?.price || 0;
  const stayNightly = stays[0]?.nightlyPrice || 0;
  const estimatedTotal = Math.round(bestFlight + stayNightly * nights);

  // Stable pseudo-random pick so the same trip reads the same way twice, but
  // the app doesn't repeat one canned sentence at every user forever.
  const pick = (arr) => {
    const seed = `${intent.destination}${nights}`.split('')
      .reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
    return arr[seed % arr.length];
  };
  // Lead with the number they care about and stop — no "Here's a…", and no
  // listing back the sections the card already shows.
  // Nothing priced came back (a provider is down or unkeyed) — don't announce
  // "$0, under your budget", which reads as a bargain rather than a gap.
  const intro = estimatedTotal <= 0
    ? pick([
        `Here's the shape of ${nights} nights in ${intent.destination}. Live prices aren't coming through right now.`,
        `${intent.destination}, ${nights} nights. I couldn't pull prices this time — the plan's still good.`,
      ])
    : pick([
        `${nights} nights in ${intent.destination}. ${money(estimatedTotal, budgetLimit)}`,
        `${intent.destination}, ${nights} nights — ${money(estimatedTotal, budgetLimit)}`,
        `Got you ${nights} nights in ${intent.destination}. ${money(estimatedTotal, budgetLimit)}`,
      ]);

  const days = buildDays(intent, activities);
  emit('days', 'done', {
    count: days.length,
    detail: days.length ? `${days.length} day${days.length === 1 ? '' : 's'} mapped out` : null,
  });

  return {
    intro,
    // One short question, not a menu of three options.
    followUp: pick([
      'Want it cheaper?',
      'Anything you want swapped?',
      'Too packed, or about right?',
      'Want me to shift the dates?',
    ]),
    trip: {
      destination: intent.destination,
      country: intent.country || '',
      // A real photograph of the place, with the credit its licence requires.
      heroImage: photo?.url || null,
      heroCredit: photo ? [photo.credit, photo.license].filter(Boolean).join(' · ') : null,
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
      days,
      activities,
      restaurants,
      // Ground transport — trains (region-aware) and car rentals, deep-linked.
      // Booking sites for the whole trip, dates already filled in — the app
      // shows these instead of a list of hotel names.
      stayLinks: stayLinks(intent.destination, intent.checkin || daysFromNow(30),
                           intent.checkout || daysFromNow(30 + nights),
                           partySize(intent.travelers), process.env.BOOKING_AID || ''),
    },
  };
}


/**
 * Where to book a room, with the dates already filled in.
 *
 * The whole point is that tapping out of Scout lands on a search that already
 * knows your city, your nights and how many of you there are — if the user has
 * to re-enter the dates on the far side, the handoff was pointless. Each site
 * wants them in its own parameter names, so they're written out per site rather
 * than shared: getting one wrong silently drops the dates instead of erroring.
 */
export function stayLinks(place, checkin, checkout, adults = 2, aid = '') {
  const q = encodeURIComponent;
  const guests = Math.max(1, Number(adults) || 2);
  const dated = Boolean(checkin && checkout);

  const links = [];

  // Booking.com: ISO dates, and it needs the party size or it defaults to two.
  links.push({
    site: 'Booking.com',
    url: `https://www.booking.com/searchresults.html?ss=${q(place)}`
      + (dated ? `&checkin=${checkin}&checkout=${checkout}` : '')
      + `&group_adults=${guests}&no_rooms=1&group_children=0`
      + (aid ? `&aid=${aid}` : ''),
  });

  // Expedia and Hotels.com share a platform and its parameter names.
  for (const [site, host] of [['Expedia', 'expedia.com'], ['Hotels.com', 'hotels.com']]) {
    links.push({
      site,
      url: `https://www.${host}/Hotel-Search?destination=${q(place)}`
        + (dated ? `&startDate=${checkin}&endDate=${checkout}` : '')
        + `&adults=${guests}&rooms=1`,
    });
  }

  // Airbnb, for anyone who'd rather have a flat than a hotel.
  links.push({
    site: 'Airbnb',
    url: `https://www.airbnb.com/s/${q(place)}/homes`
      + (dated ? `?checkin=${checkin}&checkout=${checkout}&adults=${guests}` : `?adults=${guests}`),
  });

  // Google Hotels deliberately left out. It takes no date parameters that
  // survive a plain link, and the app tells the user their dates are already
  // filled in — one pill that silently drops them makes that line a lie.

  return links.map((l) => ({ datesCarried: dated, ...l }));
}

/** "2 adults, 1 child" / "Solo" → a number. */
function partySize(travelers) {
  if (!travelers) return 2;
  const t = String(travelers).toLowerCase();
  if (t.includes('solo') || t.includes('just me')) return 1;
  const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 2;
}

// --- Ground transport links -------------------------------------------------

// --- Multi-source booking menus --------------------------------------------
// Every stay/activity/restaurant gets deep links to several well-known sites,
// prefilled with the place + city (+ dates for hotels), so users compare and
// book wherever they're comfortable. Booking.com carries the affiliate id.
function attachLinkMenus({ stays, activities, restaurants }, intent) {
  const city = intent.destination || '';
  const checkin = intent.checkin;
  const checkout = intent.checkout;
  const adults = partySize(intent.travelers);
  const aid = process.env.BOOKING_AID || '';
  const q = (s) => encodeURIComponent(s);

  for (const s of stays) {
    if (s.bookingOptions) continue;
    const place = `${s.name} ${city}`;
    const dates = checkin && checkout ? `&checkin=${checkin}&checkout=${checkout}` : '';
    const eDates = checkin && checkout ? `&startDate=${checkin}&endDate=${checkout}` : '';
    s.bookingOptions = stayLinks(place, checkin, checkout, adults, aid);
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
