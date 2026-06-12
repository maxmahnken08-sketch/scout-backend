// Lightweight usage stats for the admin dashboard. Zero dependencies:
// in-memory counters bucketed by day, periodically flushed to a JSON file so
// they survive restarts. (Render's free tier resets the disk on each DEPLOY,
// so history restarts when new code ships — fine for v1.)
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'stats.json');
const startedAt = new Date().toISOString();

let data = { days: {}, recent: [], totals: { chats: 0, plans: 0, bookings: 0, bookedVolume: 0 } };
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch { /* fresh start */ }

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(data));
    } catch (err) { console.warn('stats save failed:', err?.message); }
  }, 2000);
}

function today() { return new Date().toISOString().slice(0, 10); }
function bucket() {
  const d = today();
  data.days[d] ??= { chats: 0, plans: 0, bookings: 0, bookedVolume: 0, destinations: {} };
  return data.days[d];
}

/** Record one event: 'chat' | 'plan' | 'booking'. */
export function record(event, props = {}) {
  try {
    const b = bucket();
    if (event === 'chat') { b.chats++; data.totals.chats++; }
    if (event === 'plan') {
      b.plans++; data.totals.plans++;
      if (props.destination) {
        b.destinations[props.destination] = (b.destinations[props.destination] || 0) + 1;
      }
    }
    if (event === 'booking') {
      b.bookings++; data.totals.bookings++;
      const amt = Number(props.amount) || 0;
      b.bookedVolume += amt; data.totals.bookedVolume += amt;
    }
    data.recent.unshift({ at: new Date().toISOString(), event, ...props });
    if (data.recent.length > 50) data.recent.length = 50;
    scheduleSave();
  } catch { /* stats must never break the API */ }
}

/** Summary for the dashboard. */
export function summary() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const b = data.days[d] || { chats: 0, plans: 0, bookings: 0, bookedVolume: 0, destinations: {} };
    days.push({ date: d, ...b });
  }
  const destTotals = {};
  for (const d of Object.values(data.days)) {
    for (const [k, v] of Object.entries(d.destinations || {})) destTotals[k] = (destTotals[k] || 0) + v;
  }
  const topDestinations = Object.entries(destTotals)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  return { startedAt, totals: data.totals, days, topDestinations, recent: data.recent.slice(0, 20) };
}
