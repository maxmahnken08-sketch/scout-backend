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
const VOYAGE = 'https://en.wikivoyage.org/w/api.php';
const UNSPLASH = 'https://api.unsplash.com/search/photos';
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
 * Is this actually a photograph of the place?
 *
 * Wikivoyage's page image is just the article's first image, which for Lisbon
 * is a map of the city's districts. Wikipedia's lead image is usually better but
 * can be a coat of arms. Both are worse than no picture on a travel hero, so
 * anything that smells like a diagram gets thrown out by name, and anything
 * taller than it is wide gets thrown out by shape — heroes are landscape.
 */
function looksLikeAPhoto(url, width, height) {
  if (!url) return false;
  const name = decodeURIComponent(url.split('?')[0]).toLowerCase();
  if (/\.svg$/.test(name)) return false;
  const banned = ['map', 'district', 'diagram', 'flag', 'coat_of_arms', 'coatofarms',
                  'seal', 'logo', 'locator', 'location', 'plan_', 'chart', 'graph',
                  'blank', 'outline', 'divisions', 'freguesias'];
  if (banned.some((w) => name.includes(w))) return false;
  if (width && height && height > width * 1.05) return false;   // portrait
  return true;
}

/** Wikivoyage's page image — a scenic shot far more often than not. */
async function fromWikivoyage(title) {
  try {
    const params = new URLSearchParams({
      action: 'query', format: 'json', titles: title,
      prop: 'pageimages', piprop: 'original', redirects: '1',
    });
    const res = await fetch(`${VOYAGE}?${params}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const page = Object.values(data?.query?.pages || {})[0] || {};
    const o = page.original;
    if (!o?.source) return null;
    // Wikivoyage appends a tracking query; the file itself is the bit before it.
    const clean = o.source.split('?')[0];
    return looksLikeAPhoto(clean, o.width, o.height) ? clean : null;
  } catch {
    return null;
  }
}

/**
 * Unsplash, when a key is present. Professionally shot, properly licensed for
 * commercial use, and free — but it needs an access key, so everything above
 * exists to make sure the app is never without a picture in the meantime.
 */
async function fromUnsplash(city, country) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({
      query: [city, country].filter(Boolean).join(' '),
      orientation: 'landscape', per_page: '1', content_filter: 'high',
    });
    const res = await fetch(`${UNSPLASH}?${params}`, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit?.urls?.regular) return null;
    return {
      url: hit.urls.regular,
      credit: hit.user?.name || 'Unsplash',
      license: 'Unsplash',
      source: 'unsplash',
    };
  } catch {
    return null;
  }
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
    // Best first. Unsplash is curated travel photography; Wikivoyage is written
    // for travellers so its pictures usually are too; Wikipedia is the backstop.
    const unsplash = await fromUnsplash(name, country);
    if (unsplash) return remember(key, unsplash);

    for (const title of [name, country ? `${name}, ${country}` : null].filter(Boolean)) {
      const voyage = await fromWikivoyage(title);
      if (voyage) return remember(key, await withCredit(voyage));
    }

    for (const title of [name, country ? `${name}, ${country}` : null].filter(Boolean)) {
      const res = await fetch(`${SUMMARY}/${encodeURIComponent(title)}`, {
        headers: { 'User-Agent': UA, accept: 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.type === 'disambiguation') continue;

      const img = data.originalimage || data.thumbnail;
      const url = img?.source;
      if (!url || !/^https:/.test(url)) continue;
      if (!looksLikeAPhoto(url, img.width, img.height)) continue;

      return remember(key, await withCredit(url));
    }
    return remember(key, null);
  } catch (err) {
    console.warn('Destination photo failed:', err?.message || err);
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
