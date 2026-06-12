// Travelpayouts — indie-friendly affiliate APIs (free, personal-email signup).
// Flights via the Aviasales Data API, hotels via Hotellook. Both return real
// prices + affiliate deep-links (you earn commission on bookings).
//
// Env: TRAVELPAYOUTS_TOKEN (API token), TRAVELPAYOUTS_MARKER (affiliate id, for links).
// NOTE: field mappings below follow the public API docs — verify against a live
// token's response and tweak map() if a field name differs.

const TOKEN = () => process.env.TRAVELPAYOUTS_TOKEN;
const MARKER = () => process.env.TRAVELPAYOUTS_MARKER || "";

// Common IATA airline codes → display names (fallback to the code).
const AIRLINES = {
  DL: "Delta", AA: "American Airlines", UA: "United", B6: "JetBlue",
  WN: "Southwest", AS: "Alaska", NK: "Spirit", F9: "Frontier",
  NH: "ANA", JL: "JAL", AC: "Air Canada", BA: "British Airways",
  AF: "Air France", LH: "Lufthansa", TP: "TAP Air Portugal", EK: "Emirates",
  EY: "Etihad", QR: "Qatar Airways", TK: "Turkish Airlines", SQ: "Singapore Airlines",
  KL: "KLM", IB: "Iberia", VS: "Virgin Atlantic", DY: "Norwegian", ZG: "Zipair",
  CX: "Cathay Pacific", KE: "Korean Air", OZ: "Asiana", CI: "China Airlines",
  N0: "Norse Atlantic", FI: "Icelandair", EI: "Aer Lingus", LX: "SWISS",
  OS: "Austrian", SK: "SAS", AY: "Finnair", AZ: "ITA Airways", LO: "LOT Polish",
  U2: "easyJet", FR: "Ryanair", W6: "Wizz Air", VY: "Vueling",
  AM: "Aeroméxico", Y4: "Volaris", VB: "Viva Aerobus", CM: "Copa Airlines",
  AV: "Avianca", LA: "LATAM", G3: "GOL", AD: "Azul", BW: "Caribbean Airlines",
  WS: "WestJet", PD: "Porter", HA: "Hawaiian", G4: "Allegiant", SY: "Sun Country",
  MX: "Breeze Airways", BR: "EVA Air", TG: "Thai Airways", VN: "Vietnam Airlines",
  MH: "Malaysia Airlines", AI: "Air India", ET: "Ethiopian", MS: "EgyptAir",
};

function minutesToText(min) {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : "", m ? `${String(m).padStart(2, "0")}m` : ""].filter(Boolean).join(" ");
}

// --- Flights (used by the flights selector) -------------------------------

export async function searchTravelpayoutsFlights(intent) {
  if (!TOKEN()) return [];
  // No IATA code (unknown city) → can't query the flight API; let it fall back.
  if (!intent.destinationCode) return [];
  try {
    const origin = intent.origin || "JFK";
    const dest = intent.destinationCode;
    const fullDate = intent.departureDate || daysFromNow(30); // YYYY-MM-DD
    const month = fullDate.slice(0, 7);                        // YYYY-MM

    const query = async (departure_at) => {
      const params = new URLSearchParams({
        origin, destination: dest, departure_at,
        currency: "usd", sorting: "price", direct: "false", limit: "5",
        one_way: "true", token: TOKEN(),
      });
      const res = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`);
      if (!res.ok) throw new Error(`Travelpayouts flights ${res.status}`);
      const json = await res.json();
      return json.data || [];
    };

    // Prefer the exact requested date; if no fares that day, widen to the month.
    let data = await query(fullDate);
    if (!data.length) data = await query(month);

    const returnDate = intent.checkout || null;
    return data.slice(0, 3).map((f) => {
      const aviasales = f.link
        ? `https://www.aviasales.com${f.link}${MARKER() ? `?marker=${MARKER()}` : ""}`
        : "https://www.aviasales.com";
      const options = bookingOptions(origin, dest, fullDate, returnDate, aviasales);
      return {
        airline: AIRLINES[f.airline] || f.airline,
        route: `${f.origin_airport || f.origin} → ${f.destination_airport || f.destination}`,
        duration: minutesToText(f.duration),
        stops: !f.transfers ? "Nonstop" : `${f.transfers} stop${f.transfers > 1 ? "s" : ""}`,
        price: Math.round(f.price),
        // Primary link = Expedia (most trusted by US users); full menu in bookingOptions.
        bookingURL: options[0].url,
        bookingOptions: options,
      };
    });
  } catch (err) {
    console.warn("Travelpayouts flights failed:", err?.message || err);
    return [];
  }
}

// --- Booking links across many sources -------------------------------------
// Deep-links with the route + dates prefilled, so the user lands on live,
// bookable prices on a site they already trust. Aviasales keeps the affiliate
// marker; the rest are plain links (swap in affiliate IDs later if approved).
export function bookingOptions(origin, dest, departISO, returnISO, aviasalesURL) {
  const [y, m, d] = departISO.split("-");
  const usDate = `${Number(m)}/${Number(d)}/${y}`;           // 6/19/2026 (Expedia)
  const yymmdd = departISO.slice(2).replaceAll("-", "");      // 260619 (Skyscanner)
  const compact = departISO.replaceAll("-", "");              // 20260619 (Priceline)

  let ry, rm, rd, rUS, rYY, rCompact;
  if (returnISO) {
    [ry, rm, rd] = returnISO.split("-");
    rUS = `${Number(rm)}/${Number(rd)}/${ry}`;
    rYY = returnISO.slice(2).replaceAll("-", "");
    rCompact = returnISO.replaceAll("-", "");
  }

  const gq = returnISO
    ? `Flights from ${origin} to ${dest} on ${departISO} through ${returnISO}`
    : `One way flights from ${origin} to ${dest} on ${departISO}`;

  const expedia = returnISO
    ? `https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=from:${origin},to:${dest},departure:${usDate}TANYT&leg2=from:${dest},to:${origin},departure:${rUS}TANYT&passengers=adults:1&options=cabinclass:economy&mode=search`
    : `https://www.expedia.com/Flights-Search?trip=oneway&leg1=from:${origin},to:${dest},departure:${usDate}TANYT&passengers=adults:1&options=cabinclass:economy&mode=search`;

  const options = [
    { site: "Expedia", url: expedia },
    { site: "Google Flights", url: `https://www.google.com/travel/flights?q=${encodeURIComponent(gq)}` },
    { site: "Kayak", url: `https://www.kayak.com/flights/${origin}-${dest}/${departISO}${returnISO ? `/${returnISO}` : ""}` },
    { site: "Skyscanner", url: `https://www.skyscanner.com/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${yymmdd}/${returnISO ? `${rYY}/` : ""}` },
    { site: "Priceline", url: `https://www.priceline.com/m/fly/search/${origin}-${dest}-${compact}${returnISO ? `/${dest}-${origin}-${rCompact}` : ""}/` },
  ];
  if (aviasalesURL) options.push({ site: "Aviasales", url: aviasalesURL });
  return options;
}

// --- Flexible-dates deal check (Hopper-style, gentle) ---------------------
// Looks at prices around the requested departure date; if a nearby date is
// meaningfully cheaper, returns a soft suggestion. Returns null otherwise so
// the app shows nothing (never pushy).
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function niceDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}`;
}

export async function flightDeal(intent) {
  if (!TOKEN() || !intent.destinationCode || !intent.departureDate) return null;
  try {
    const origin = intent.origin || 'JFK';
    const month = intent.departureDate.slice(0, 7);
    const params = new URLSearchParams({
      origin, destination: intent.destinationCode, departure_at: month,
      currency: 'usd', sorting: 'price', direct: 'false', limit: '30', one_way: 'true', token: TOKEN(),
    });
    const res = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()).data || [];
    if (data.length < 2) return null;

    // Map each date → cheapest price; restrict to within 7 days of the request.
    const byDate = {};
    for (const f of data) {
      const date = (f.departure_at || '').slice(0, 10);
      if (!date) continue;
      const price = Math.round(f.price);
      if (!byDate[date] || price < byDate[date]) byDate[date] = price;
    }
    const reqDate = intent.departureDate;
    const reqTime = new Date(reqDate).getTime();
    const within7 = Object.entries(byDate).filter(([dt]) =>
      Math.abs(new Date(dt).getTime() - reqTime) <= 7 * 86400000);
    if (!within7.length) return null;

    const requestedPrice = byDate[reqDate] ?? Math.min(...within7.map(([, p]) => p));
    let [bestDate, bestPrice] = within7.reduce((a, b) => (b[1] < a[1] ? b : a));
    const savings = requestedPrice - bestPrice;

    // Only suggest when it's a real win and a different day.
    if (bestDate !== reqDate && savings >= Math.max(25, requestedPrice * 0.1)) {
      return {
        suggestedDate: bestDate,
        savings,
        note: `Flexible on dates? Leaving ${niceDate(bestDate)} looks about $${savings} cheaper.`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// --- Hotels (registered as a stays provider) ------------------------------

export const travelpayoutsStays = {
  name: "Travelpayouts (Hotellook)",
  kind: "stays",
  async search(intent) {
    if (!TOKEN()) return stubStays(intent);
    try {
      const city = intent.destination || "Tokyo";
      const checkIn = intent.checkin || daysFromNow(30);
      const checkOut = intent.checkout || daysFromNow(36);
      const params = new URLSearchParams({
        location: city, currency: "usd", checkIn, checkOut, limit: "5", token: TOKEN(),
      });
      const res = await fetch(`https://engine.hotellook.com/api/v2/cache.json?${params}`);
      if (!res.ok) throw new Error(`Hotellook ${res.status}`);
      const json = await res.json();
      const hotels = Array.isArray(json) ? json : (json.hotels || []);
      if (!hotels.length) return stubStays(intent);
      return hotels.slice(0, 3).map((h) => ({
        name: h.hotelName || h.name || "Hotel",
        area: h.location?.name || city,
        nightlyPrice: Math.round(h.priceFrom || h.priceAvg || 0),
        rating: Number(h.stars || 4),
        tag: "Travelpayouts",
        bookingURL: `https://search.hotellook.com${MARKER() ? `?marker=${MARKER()}` : ""}`,
      }));
    } catch (err) {
      console.warn("Travelpayouts hotels failed:", err?.message || err);
      return stubStays(intent);
    }
  },
};

function stubStays(intent) {
  const city = intent.destination || "Tokyo";
  return [
    { name: `${city} Central Hotel`, area: "Downtown", nightlyPrice: 78, rating: 4.4, tag: "Travelpayouts", bookingURL: "https://search.hotellook.com" },
    { name: `${city} Boutique Stay`, area: "Old town", nightlyPrice: 104, rating: 4.7, tag: "Travelpayouts", bookingURL: "https://search.hotellook.com" },
  ];
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
