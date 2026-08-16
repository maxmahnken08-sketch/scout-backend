// Stays — Booking.com Demand API. Live when BOOKING_TOKEN + BOOKING_AFFILIATE_ID set.
//
// ⚠️ Requires Booking.com partner approval (not instant). The Demand API also
//    typically resolves a destination id first (/common/locations) then searches
//    accommodations. Body/field shapes below follow Demand API v3.1 — verify
//    against your account and adjust map() as needed.

import { httpsOrNull } from './liteapi.js';

const API = 'https://demandapi.booking.com/3.1/accommodations/search';

// Booking.com returns photo URLs with a {size} placeholder in some shapes;
// request a large square when we see one.
function imageOf(h) {
  const raw =
    h?.photos?.[0]?.url ||
    h?.main_photo_url ||
    h?.photo_url ||
    (typeof h?.photos?.[0] === 'string' ? h.photos[0] : null);
  if (typeof raw !== 'string') return null;
  return httpsOrNull(raw.replace('{size}', 'square500'));
}

export const booking = {
  name: 'Booking.com',
  kind: 'stays',
  async search(intent) {
    // Keyless → return nothing (another stays provider supplies results).
    if (!process.env.BOOKING_TOKEN || !process.env.BOOKING_AFFILIATE_ID) return [];
    try {
      return await live(intent);
    } catch (err) {
      console.warn('Booking.com live search failed:', err?.message || err);
      return [];
    }
  },
};

async function live(intent) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.BOOKING_TOKEN}`,
      'X-Affiliate-Id': process.env.BOOKING_AFFILIATE_ID,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      booker: { country: 'us', platform: 'desktop' },
      checkin: intent.checkin || daysFromNow(30),
      checkout: intent.checkout || daysFromNow(36),
      city_name: intent.destination,
      currency: 'USD',
      rows: 5,
    }),
  });
  if (!res.ok) throw new Error(`Booking ${res.status}`);
  const json = await res.json();
  return (json?.data ?? []).slice(0, 3).map((h) => ({
    name: h.name,
    area: h.district || '',
    nightlyPrice: Math.round(h.price?.amount ?? 0),
    rating: Number(h.review_score ? h.review_score / 2 : 4.5), // 10-scale -> 5-scale
    tag: 'Booking.com',
    bookingURL: h.url || 'https://www.booking.com',
    imageURL: imageOf(h),
  }));
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
