// Stays — Expedia Rapid API. Live when EXPEDIA_API_KEY + EXPEDIA_SHARED_SECRET are set.
//
// ⚠️ Requires an Expedia Partner Solutions agreement (approval-gated, not instant).
// ⚠️ Rapid is multi-step: resolve a region_id (GET /v3/regions), call availability
//    for that region, then fetch property content (GET /v3/properties/content) for
//    names/areas. The call below is the availability step; verify params + mapping
//    against your Rapid account, and join content for human-readable names.

import crypto from 'node:crypto';
import { httpsOrNull } from './liteapi.js';

const HOST = 'https://api.ean.com';

// Property photography comes from the /v3/properties/content join, which the
// caller stashes on intent.contentById alongside name and area.
function imageOf(content) {
  const img = content?.images?.[0];
  const candidate =
    img?.links?.['1000px']?.href ||
    img?.links?.['350px']?.href ||
    img?.href ||
    content?.thumbnail;
  return httpsOrNull(candidate);
}

export const expedia = {
  name: 'Expedia Rapid',
  kind: 'stays',
  async search(intent) {
    // Keyless → return nothing (another stays provider supplies results).
    if (!process.env.EXPEDIA_API_KEY || !process.env.EXPEDIA_SHARED_SECRET) return [];
    try {
      return await live(intent);
    } catch (err) {
      console.warn('Expedia Rapid live search failed:', err?.message || err);
      return [];
    }
  },
};

// EAN signature auth: SHA-512(apiKey + sharedSecret + unixSeconds)
function authHeader() {
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto
    .createHash('sha512')
    .update(process.env.EXPEDIA_API_KEY + process.env.EXPEDIA_SHARED_SECRET + ts)
    .digest('hex');
  return `EAN APIKey=${process.env.EXPEDIA_API_KEY},Signature=${sig},timestamp=${ts}`;
}

async function live(intent) {
  if (!intent.expediaRegionId) return []; // resolve region via /v3/regions before going live
  const params = new URLSearchParams({
    checkin: intent.checkin || daysFromNow(30),
    checkout: intent.checkout || daysFromNow(36),
    currency: 'USD',
    country_code: 'US',
    language: 'en-US',
    occupancy: '2',
    region_id: String(intent.expediaRegionId),
    sort_type: 'PRICE_LOW_TO_HIGH',
  });
  const res = await fetch(`${HOST}/v3/properties/availability?${params}`, {
    headers: { Authorization: authHeader(), Accept: 'application/json', 'Customer-Ip': '1.1.1.1' },
  });
  if (!res.ok) throw new Error(`Expedia ${res.status}`);
  const json = await res.json();
  // json is an array of property availability; join with /v3/properties/content for names.
  return (json ?? []).slice(0, 3).map((p) => ({
    name: intent.contentById?.[p.property_id]?.name || `Property ${p.property_id}`,
    area: intent.contentById?.[p.property_id]?.area || '',
    nightlyPrice: Math.round(p.rooms?.[0]?.rates?.[0]?.nightly?.[0]?.[0]?.value ?? 0),
    rating: 4.5,
    tag: 'Expedia',
    bookingURL: 'https://www.expedia.com',
    imageURL: imageOf(intent.contentById?.[p.property_id]),
  }));
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
