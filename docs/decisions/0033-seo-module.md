# 0033. SEO is an optional module on shared search data, sold by limits

- Status: Accepted
- Date: 2026-11-22
- Affects: seo, integrations, app.config.ts

## Context

OpenMarko's first product area is local SEO: where a business shows on Google Maps, on Google search and in AI answers, who beats it, and what to do about it (the mock at `apps/mock/src/pages/seo`). The data comes from DataForSEO (searches), Google Places (finding the business) and the Google Business Profile (changing the profile, calls and clicks). One Organization can have several businesses, and one public business is a competitor to many Organizations.

## Decision

- **One optional module, `seo`**, switched on in `app.config.ts`. It needs `automation`. The data model is in [docs/features/seo/data-model.md](../features/seo/data-model.md).
- **Three layers of data.** A public catalog shared by every Organization (`places`, `place_snapshots`, `keyword_metrics`), with no `organization_id` and nothing about who tracks what. What an Organization tracks (`locations`, `websites`, `keywords`, `questions`, `competitor_overrides`, `suggestions`). Results, whose summaries (`map_scans`, `map_standings`, `serp_results`, `ai_answers`) are written once, when results arrive.
- **Competitors are found, not typed.** They are the businesses and sites in the results. Only exceptions are stored: added by hand, or hidden.
- **Providers stay behind capabilities.** `search.maps`, `search.organic`, `search.ai`, `search.keywords`, `places.find`, `places.details` and `profile.manage` in integrations. Searches are asked in two steps, post and collect, because DataForSEO's standard queue costs about a third of its live price. DataForSEO calls back when a task is ready (a signed pingback), and a job polls every minute as a fallback.
- **Checks run as automation Runs on automation's schedule**, one schedule per Location. A Run's cost is the sum of its provider calls. Launch and newly tracked keywords and questions check at once.
- **Suggestions are applied through automation Tasks** (ADR 0005). The Task executor makes the change and keeps what Undo needs; Activity records it; Autopilot can apply a kind on its own. A suggestion's fingerprint keeps an applied or dismissed one from coming back.
- **The app pays for search data; customers buy limits.** Locations, keywords and questions per Location, grid size, and checks a month. DataForSEO and Google Places are app-only Connections whose usage is recorded as cost-only meters, never blocked by a Plan. App admins see the spend.
- **Google Business Profile connects with OAuth.** Integrations gained a generic OAuth Connection: signed state, a callback, and a refresh token stored as the Connection's secret.
- **Permissions:** one resource, `seo`, with `view`, `track` (edit), `publish` (changes and posts that go out under the business's name) and `manage` (Locations, what checks cost, linking Google).

## Consequences

- A business tracked by many Organizations is one row, and its rating history builds up for everyone.
- The time-series tables grow by about 8,000 rows per Location per month. They are indexed by `(location_id, checked_at)` and can be split by month later without changing queries.
- Live DataForSEO and Google calls are written to their documented APIs but untested against real accounts until keys exist. Stubs answer from a made-up market of dental practices in Austin.
- Description and post drafts come from templates, not a model, so the module doesn't need `ai`.
