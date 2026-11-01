# Local SEO / Business Profile: technical

## Code map

| File | Role |
|---|---|
| [pages/Profile.tsx](../../../ui-mock/src/pages/Profile.tsx) | Business Profile + Reviews tab |
| [data/mock.ts](../../../ui-mock/src/data/mock.ts) | `business`, `locations`, keywords, competitors, factors, audit, actions, content (Location `loc_1`) |
| [data/scoped.ts](../../../ui-mock/src/data/scoped.ts) | Per-Location / per-Website data (Mueller `loc_2`, `web_2`) |
| [lib/api.ts](../../../ui-mock/src/lib/api.ts) | Endpoint map (DataForSEO, Google), `gridCoordinates`, `estimateGridCost`, `api` stubs |
| [lib/setup.ts](../../../ui-mock/src/lib/setup.ts) | `hasGoogleBusinessProfile(locationId)` |

## Permissions (`seo`)

view (see Business Profile and SEO overview) · edit (edit details) · publish (publish profile changes and Google posts) · connect (connect Google Business Profiles, manage).

## Integrations

Google Business Profile provider, per Location: `reviews.read`, `reviews.reply`, `profile.edit`, `profile.posts`, `profile.insights`.

## Real build

- Backend holds Google OAuth tokens and DataForSEO Basic auth; never call from the browser.
- Business Information API: `PATCH locations/{id}?updateMask=…` for edits.
- Business Profile Performance API (`fetchMultiDailyMetricsTimeSeries`) for insights.
- v4 `localPosts` for Google posts.
- Profile sync job (default every 6h) → Run rows.
- Everything stored per Location.

## Backend (built)

The SEO module is `modules/seo` ([backend technical](../../platform/backend/technical.md)). Its tables are in the `seo` schema (`modules/seo/src/schema.ts`). Status: **services, jobs and routes built, against stub providers**. Live provider calls are written but not run against the real APIs.

| Area | Built | Code |
|---|---|---|
| Business Profile | connect per Location (the Google account is an Integration Connection), review and insight sync, profile edits as Tasks | `profile.ts`, `tasks.ts` |
| Reviews | sync (once per review; `review.received` in the same transaction), drafted replies as Tasks, Undo, low-rating drafts | `reviews.ts`, `module.ts` |
| Rankings | keywords, scans (organic for the primary website and local pack for the Location), competitors | `rankings.ts` |
| AI answers | questions, checks across the assistant, whether the Location is listed | `ai.ts` |
| Site health | domain audit, issues | `audit.ts` |
| Citations | six directories, found or missing | `citations.ts` |
| Articles | drafts; publishing through the website's own CMS (ADR 0016), keeping the CMS's id and URL | `articles.ts` |

Also built: grid scans (a size×size map grid per keyword, one billed request per point), review requests by email (metered, needs a sending connection and a Place ID), backlinks (new referring domains; links that stop appearing are kept, marked lost), and site fixes (an audit issue becomes a `site_fix` Task that reads the current title, writes through WordPress, and can be undone).

Every route checks the feature, then the action, then calls a service. Long work is queued (`seo.*` jobs) and records a Run.

Status of the parts that touch outside services: all stub-tested. The WordPress publish path and the Google Business Profile reviews and reply path are written against the real APIs but not yet run against them. Keyword ideas have an adapter but no route. Set-title and meta fixes are stub-only. Full table list: [seo-schema.md](../../platform/backend/seo-schema.md).
