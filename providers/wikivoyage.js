// Restaurants from Wikivoyage — the keyless "eat" source.
//
// Google Places needs a billing account and Foursquare needs a signup, so
// without this Sage has nothing. Wikivoyage's "Eat" sections are written by
// travellers, list real named restaurants with prices and descriptions, and run
// on Wikimedia infrastructure that stays up.
//
// Coverage is uneven and we work around it:
//   · Big cities delegate listings to district sub-pages ("Lisbon/Baixa"), so
//     when the main article is thin we discover districts and merge them.
//   · Some cities (Kyoto) have an Eat section with no structured listings at
//     all — those fall through to OpenStreetMap, which is unreliable enough
//     that it's a last resort rather than the primary.
//
// No ratings anywhere here, so rating stays null rather than invented.
// Content © Wikivoyage contributors, CC BY-SA.

import { httpsOrNull } from './liteapi.js';

const API = 'https://en.wikivoyage.org/w/api.php';
const UA = 'ScoutTravel/1.0 (+https://scouttravel.app; maxmahnken08@gmail.com)';

const hasRealProvider = () => !!process.env.GOOGLE_PLACES_API_KEY;

const TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map();
const cached = (k) => {
  const h = cache.get(k);
  return h && Date.now() - h.at < TTL_MS ? h.value : null;
};
const remember = (k, v) => {
  cache.set(k, { at: Date.now(), value: v });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return v;
};

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikivoyage ${res.status}`);
  return res.json();
}

/** Index of the "Eat" section on a page, or null. */
async function eatSection(page) {
  const json = await api({ action: 'parse', page, prop: 'sections' });
  const sections = json?.parse?.sections || [];
  return sections.find((s) => (s.line || '').toLowerCase() === 'eat')?.index ?? null;
}

/** Pull one field out of a listing template block. */
function field(block, key) {
  const m = block.match(new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n}]*)`, 'i'));
  return m ? m[1].trim() : '';
}

/** Strip the wiki markup that survives inside description text. */
function clean(text) {
  return text
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')  // [[Link|label]] -> label
    .replace(/'{2,}/g, '')                            // bold/italic
    .replace(/<[^>]+>/g, '')                          // stray html
    .replace(/\s+/g, ' ')
    .trim();
}

async function listingsOn(page) {
  const idx = await eatSection(page);
  if (idx === null) return [];
  const json = await api({ action: 'parse', page, prop: 'wikitext', section: String(idx) });
  const wikitext = json?.parse?.wikitext?.['*'] || '';
  // Listing templates are {{eat|...}} / {{listing|type=eat|...}} / {{see|...}}.
  // Match any template that carries a name field, then keep the ones that look
  // like places rather than layout helpers.
  const blocks = wikitext.match(/\{\{[^{}]*\bname\s*=[^{}]*\}\}/gs) || [];
  return blocks
    .map((b) => ({
      name: clean(field(b, 'name')),
      price: clean(field(b, 'price')),
      content: clean(field(b, 'content')),
      url: field(b, 'url'),
    }))
    .filter((x) => x.name && x.name.length > 1);
}

/** "Lisbon" -> ["Lisbon/Baixa", "Lisbon/Alfama", ...] */
async function districtsOf(city) {
  try {
    const json = await api({
      action: 'query', list: 'prefixsearch',
      pssearch: `${city}/`, pslimit: '8',
    });
    return (json?.query?.prefixsearch || []).map((p) => p.title);
  } catch {
    return [];
  }
}

function toDiningSpot(x, city) {
  const bits = [x.content, x.price].filter(Boolean).join(' · ');
  return {
    name: x.name,
    // Wikivoyage has no cuisine field, so describe it from what's there.
    cuisine: bits ? bits.slice(0, 80) : 'Recommended by travellers',
    rating: null,                 // no ratings on Wikivoyage — don't invent one
    tag: 'Wikivoyage pick',
    bookingURL: httpsOrNull(x.url)
      || `https://www.google.com/maps/search/${encodeURIComponent(`${x.name} ${city}`)}`,
  };
}

export const wikivoyageRestaurants = {
  name: 'Wikivoyage',
  kind: 'restaurants',
  async search(intent) {
    if (hasRealProvider()) return [];
    const city = intent.destination;
    if (!city) return [];
    const key = `eat:${city.toLowerCase()}`;
    const hit = cached(key);
    if (hit) return hit;

    try {
      let found = await listingsOn(city);

      // Thin main article → the listings live on district pages.
      if (found.length < 3) {
        const districts = await districtsOf(city);
        for (const d of districts.slice(0, 4)) {
          if (found.length >= 6) break;
          try {
            found = found.concat(await listingsOn(d));
          } catch { /* skip a bad district page */ }
        }
      }

      const seen = new Set();
      const mapped = found
        .filter((x) => {
          const k = x.name.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        // Entries with a description are the ones a traveller actually wrote up.
        .sort((a, b) => (b.content ? 1 : 0) - (a.content ? 1 : 0))
        .slice(0, 4)
        .map((x) => toDiningSpot(x, city));

      return remember(key, mapped);
    } catch (err) {
      console.warn('Wikivoyage restaurants failed:', err?.message || err);
      return [];
    }
  },
};
