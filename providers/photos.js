// Destination photography from Wikimedia Commons.
//
// No API key, no signup, no billing account — which is the whole reason it's
// here. Google Places photos are better curated, but they need a Cloud project
// with billing attached, and until that exists the app was drawing procedural
// gradients where a photograph should be. A real picture of Lisbon beats a
// beautiful mesh gradient of nothing.
//
// Two requests per destination, both cached for a day:
//   1. the REST summary, for the lead image
//   2. imageinfo, for the author and licence
//
// The second one matters. Most of these are CC BY-SA, which requires crediting
// the photographer. Shipping the picture without the credit is just taking it.

const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary';
// Credits live on Commons, not on en.wikipedia. Asking the wrong host returns
// a page-not-found for the file and silently costs you the attribution.
const API = 'https://commons.wikimedia.org/w/api.php';

// Wikimedia asks for a descriptive UA with contact details on API traffic.
const UA = 'ScoutTravelApp/1.0 (https://scouttravel.app; support@scouttravel.app)';

const cache = new Map();
const TTL = 24 * 60 * 60 * 1000;

function cached(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  return null;
}

function remember(key, value) {
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Strip the HTML Wikimedia puts in its metadata fields. */
function plain(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim()
    .slice(0, 90);
}

/**
 * A photograph of a place, with the credit it's licensed under.
 * @returns {Promise<{url:string, credit:string, license:string, source:string}|null>}
 */
export async function destinationPhoto(city, country = '') {
  const name = String(city || '').trim();
  if (!name) return null;

  const key = name.toLowerCase();
  const hit = cached(key);
  if (hit !== null) return hit;

  try {
    // Try the bare name, then the name qualified by country. Plenty of cities
    // share a name — "Queenstown" alone is a disambiguation page — and a photo
    // of the wrong one is worse than no photo at all.
    const candidates = [name];
    if (country) candidates.push(`${name}, ${country}`);

    for (const title of candidates) {
      const res = await fetch(`${SUMMARY}/${encodeURIComponent(title)}`, {
        headers: { 'User-Agent': UA, accept: 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.type === 'disambiguation') continue;

      // Prefer the full-size original; the thumbnail is often only 320px wide,
      // which is soft on a hero spanning a phone screen at 3x.
      const url = data.originalimage?.source || data.thumbnail?.source;
      if (!url || !/^https:/.test(url)) continue;

      return remember(key, await withCredit(url));
    }
    return remember(key, null);
  } catch (err) {
    console.warn('Wikimedia photo failed:', err?.message || err);
    return remember(key, null);
  }
}

/** Look up who took it and under what licence. */
async function withCredit(url) {
  const base = { url, credit: 'Wikimedia Commons', license: '', source: 'wikimedia' };
  try {
    // Thumbnail URLs look like .../commons/thumb/6/6b/Kyoto.jpg/640px-Kyoto.jpg —
    // the last segment is the rendered size, not the file. The real title is the
    // segment before it.
    const parts = url.split('/');
    const file = decodeURIComponent(
      url.includes('/thumb/') ? parts[parts.length - 2] : parts[parts.length - 1] || '');
    if (!file) return base;
    const params = new URLSearchParams({
      action: 'query', format: 'json',
      titles: `File:${file}`, prop: 'imageinfo', iiprop: 'extmetadata',
    });
    const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return base;
    const data = await res.json();
    const pages = data?.query?.pages || {};
    const meta = Object.values(pages)[0]?.imageinfo?.[0]?.extmetadata || {};
    const artist = plain(meta.Artist?.value);
    const license = plain(meta.LicenseShortName?.value);
    return {
      url,
      credit: artist || 'Wikimedia Commons',
      license,
      source: 'wikimedia',
    };
  } catch {
    return base;
  }
}
