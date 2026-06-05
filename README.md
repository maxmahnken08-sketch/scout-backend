# Scout Backend — `/plan` service

The server Scout's iOS app calls to get real travel data. It parses the user's
free-text request with Claude, fans out to every travel **provider** (flights,
stays, activities, ratings), merges the results, and returns the exact JSON the
app expects (`PlanResponseDTO` in `Scout/Networking/LiveTripDataSource.swift`).

**No scraping.** Every provider is an official partner API / affiliate program —
the only path that is legal, stable, and App Store–approvable.

## Run it (zero keys needed)

```bash
cd backend
node server.js          # → http://localhost:8787
# in another terminal:
curl "http://localhost:8787/plan?q=Tokyo%20in%20spring%20under%20%242k" | jq
```

With no API keys, every provider returns realistic **stub** data and Claude intent
parsing falls back to a heuristic — so it runs immediately and returns valid JSON.

## Connect the app

1. In `Scout/Support/AppConfig.swift`, set `backendBaseURL` to `http://localhost:8787`.
2. Launch the app with `SCOUT_LIVE=1` (or flip `useLiveData` to `true`).
3. For local HTTP in the simulator, add an App Transport Security exception for
   `localhost` in `Info.plist` (dev only).

That's the **only** change needed — the UI already renders whatever the data layer returns.

## Go live (fill in the stubs)

Set env vars and replace the `// TODO` stub in each provider with the documented
real call:

| Provider | Env vars | Covers |
|---|---|---|
| `providers/duffel.js` | `DUFFEL_TOKEN` | Flights — all airlines (or swap Amadeus/Kiwi) |
| `providers/expedia.js` | `EXPEDIA_API_KEY`, `EXPEDIA_SHARED_SECRET` | Hotels & rentals |
| `providers/booking.js` | `BOOKING_AFFILIATE_ID`, `BOOKING_TOKEN` | Hotels |
| `providers/getyourguide.js` | `GETYOURGUIDE_TOKEN` | Activities |
| `providers/viator.js` | `VIATOR_API_KEY` | Activities (Tripadvisor) |
| `providers/tripadvisor.js` | `TRIPADVISOR_API_KEY` | Ratings & reviews |
| Claude intent (optional) | `ANTHROPIC_API_KEY` | Parses prompt → search params |

## Deploy to a real URL

The repo ships configs for the common free hosts (all use the `Dockerfile`):

**Render** (easiest — blueprint):
1. Push this repo to GitHub.
2. Render → New → Blueprint → select the repo (`render.yaml` is picked up).
3. After the first deploy, add your API keys in the dashboard (the `sync:false` vars).
4. You get a URL like `https://scout-backend.onrender.com`.

**Railway / Heroku** (`Procfile`): create a project from the repo, set env vars in the dashboard.

**Fly.io** (`fly.toml`):
```bash
cd backend
fly launch --copy-config --now
fly secrets set AMADEUS_CLIENT_ID=... AMADEUS_CLIENT_SECRET=... ANTHROPIC_API_KEY=...
```

**Docker anywhere**:
```bash
docker build -t scout-backend backend
docker run -p 8787:8787 --env-file backend/.env scout-backend
```

### Point the app at the deployed backend
In `Scout/Support/AppConfig.swift`, set `backendBaseURL` to your hosted URL and ship
with `useLiveData = true` (drop the `SCOUT_BACKEND` / `SCOUT_LIVE` dev overrides). Since
it's HTTPS in production, no App Transport Security exception is needed.

## Add a new travel source

Create `providers/yoursource.js` exporting `{ name, kind, async search(intent) }`,
then add it to the array in `lib/registry.js`. Nothing else changes — not the
orchestrator, not the app. That's the whole point of the registry.

## Architecture

```
GET /plan?q=...
   → lib/intent.js      parse prompt → { destination, dates, budget, ... }  (Claude or heuristic)
   → lib/registry.js    fan out to every provider by kind
       providers/*.js   flights · stays · activities · ratings
   → lib/normalize.js   merge, pick best, compute budget, build days
   → PlanResponse JSON  (matches the app's LiveTripDataSource contract)
```
