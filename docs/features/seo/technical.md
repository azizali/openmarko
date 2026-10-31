# Local SEO / Business Profile: technical

## Code map

| File | Role |
|---|---|
| [pages/Profile.tsx](../../../ui-mock/src/pages/Profile.tsx) | Business Profile + Reviews tab |
| [data/mock.ts](../../../ui-mock/src/data/mock.ts) | `business`, `locations`, keywords, competitors, factors, audit, actions, content (Location `loc_1`) |
| [data/scoped.ts](../../../ui-mock/src/data/scoped.ts) | Per-Location / per-Website data (Mueller `loc_2`, `web_2`) |
| [lib/api.ts](../../../ui-mock/src/lib/api.ts) | Endpoint map (DataForSEO, Google), `gridCoordinates`, `estimateGridCost`, `api` stubs |
| [lib/setup.ts](../../../ui-mock/src/lib/setup.ts) | `hasGoogleProfile(locationId)` |

## Permissions (`seo`)

view (see Business Profile and SEO overview) · edit (edit details) · publish (publish profile changes and Google posts) · connect (connect Google profiles, manage).

## Integrations

Google Business Profile provider, per Location: `reviews.read`, `reviews.reply`, `profile.edit`, `profile.posts`, `profile.insights`.

## Real build

- Backend holds Google OAuth tokens and DataForSEO Basic auth; never call from the browser.
- Business Information API: `PATCH locations/{id}?updateMask=…` for edits.
- Business Profile Performance API (`fetchMultiDailyMetricsTimeSeries`) for insights.
- v4 `localPosts` for Google posts.
- Profile sync job (default every 6h) → Run rows.
- Everything stored per Location.
