# Travelpayouts support request — enable Hotels Data API

Send via the Travelpayouts Help Center ("Submit a request") or support@travelpayouts.com,
or the in-dashboard chat. Do NOT include your API token in the message (keep it private);
the marker is fine (it's public).

---

**Subject:** Request access to Hotels Data API (Hotellook cache/lookup endpoints returning 404)

Hi Travelpayouts team,

I'm an affiliate (marker **736179**, account **maxmahnken08@gmail.com**) building a
travel-planning app that shows live flight and hotel prices and deep-links users to book.

The **flights** data API is working perfectly with my API token
(`api.travelpayouts.com/aviasales/v3/prices_for_dates`).

But the **hotels** data API endpoints from your documentation return **404** for me:

- `https://engine.hotellook.com/api/v2/cache.json`
- `https://engine.hotellook.com/api/v2/lookup.json`

(404 from CloudFront/nginx — tested with the token in both the `token` query param and the
`X-Access-Token` header, with and without a browser User-Agent.)

Could you please:

1. **Enable Hotels Data API access** for my account if it requires separate approval, and
2. **Confirm the current endpoint URLs + required parameters** for:
   - fetching hotel prices by city for given check-in/check-out dates, and
   - location/hotel lookup.

**Use case:** show hotel options (name, area, nightly price, star rating) for a destination
and date range, with Hotellook booking links carrying my marker (736179).

Thanks very much!
