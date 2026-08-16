// Abuse / cost protection for the expensive endpoints.
//
// /plan and /chat each fan out to Claude, LiteAPI, Google Places and friends —
// every call costs real money. Without a limit, anyone who finds the URL can run
// the bill up. This is a deliberately simple in-memory limiter: no database, no
// dependencies, and it fails open on its own bugs rather than blocking real users.
//
// Scope: one process. Render's free tier runs a single instance, so this is
// sufficient today. If you scale to multiple instances, move the counters to
// Redis or Postgres — otherwise each instance enforces its own separate budget.

const WINDOW_MS = 60 * 60 * 1000; // one hour

// Per-client hourly caps, by route.
const LIMITS = {
  plan: Number(process.env.RATE_LIMIT_PLAN || 12),
  chat: Number(process.env.RATE_LIMIT_CHAT || 60),
};

/** client key -> { count, resetAt } per bucket */
const buckets = new Map();

// Drop expired entries so the map can't grow without bound.
function sweep(now) {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}
let lastSweep = 0;

/**
 * Identify the caller. The app sends a per-install UUID in X-Scout-Client; we
 * fall back to the forwarded IP. Neither is authentication — it only has to be
 * good enough to stop casual abuse and runaway loops.
 */
export function clientKey(req) {
  const header = req.headers['x-scout-client'];
  if (typeof header === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(header)) {
    return `c:${header}`;
  }
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return `ip:${fwd || req.socket?.remoteAddress || 'unknown'}`;
}

/**
 * Consume one unit for `route`. Returns { ok, remaining, retryAfter }.
 * Unknown routes are unlimited so adding an endpoint never silently throttles it.
 */
export function consume(req, route) {
  const limit = LIMITS[route];
  if (!limit || limit <= 0) return { ok: true, remaining: Infinity, retryAfter: 0 };

  const now = Date.now();
  if (now - lastSweep > WINDOW_MS) { sweep(now); lastSweep = now; }

  const key = `${route}|${clientKey(req)}`;
  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, entry);
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true, remaining: limit - entry.count, retryAfter: 0 };
}
