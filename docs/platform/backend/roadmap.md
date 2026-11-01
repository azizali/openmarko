# Backend: roadmap

## Current state

- Built: the baseline (identity, access, features, settings, billing, organizations, integrations, automation) and every SEO feature's services, jobs and routes. The API, worker and image run against Postgres 17.
- Tests: `bun test` passes (see technical.md). The type check is clean.
- Stubs everywhere a paid or external provider sits. Live adapters are written but **not run against the real APIs**. Nothing is marked live.
- Neon project `openmarko` exists and is empty. Local development runs on Docker Postgres.

## Pieces

Each piece ends with a review, and with this file, the module's docs and any ADR updated.

### Phase 1: baseline

| # | Piece | State |
|---|---|---|
| 1 | Stack ADRs + baseline schema doc | done |
| 2 | Scaffold (Bun workspaces), kernel (config, db, ids, errors, envelope crypto, outbox, module contract), Dockerfile, pg-boss on Bun, health, `/openapi` | done |
| 3 | identity + access: Better Auth with organization plugin, membership, Roles compiled from `data/access.ts`, the caller guard | done. Custom Role create and edit routes are not built (Better Auth's endpoints exist; not wired or tested here) |
| 4 | organizations: Locations (Google Business Profile ID), Websites, Partners and Clients with consent (request and accept), whitelabel host lookup and brand settings, transfer out with per-person revoke, archive, hard delete | done. Brand fields are settings; the brand endpoint returns them |
| 5 | features + settings: feature switches (`organization.features`), scoped settings | done |
| 6 | billing: Plans, Entitlement keys, overrides, metering rules, manual provider, Stripe checkout (owner), Stripe webhook signature and status mapping | done with stubs for tests. Stripe calls are written against Stripe's REST API but **not run against Stripe** |
| 7 | integrations: connections, encrypted credentials, adapter registry, `invoke()`, metering, LLM capability (Anthropic, OpenAI, Google, OpenRouter, platform default), email adapters, WordPress adapter, signed provider webhooks (fail closed) | done (stub). Live adapters: written, not run |
| 8 | automation: outbox loop, schedules and ticker, runs with cost, tasks with Apply and Undo and Autopilot, Activity, runs and task routes, partition maintenance | done |
| 9 | seed (`scripts/seed.ts`, idempotent) and an Eden typed-client test | done. Eden types every module route through `apiShape` in `packages/platform`. The mock page wired to Eden is frontend work, not done |

### Phase 2: SEO module

| # | Piece | State |
|---|---|---|
| 10 | SEO schema doc | done: [seo-schema.md](seo-schema.md) |
| 11 | Business Profile: connect per Location, review and insight sync, profile edits as Tasks | done. Live-written: reviews, reply, insights (Performance API), token refresh. Profile edits stub-only |
| 12 | Reviews: sync, drafted replies as Tasks, Undo, low-rating drafts, review requests by email (metered) | done (stub). Email sending: stub only |
| 13 | Rankings & competitors: keywords, organic and local-pack scans, competitors, grid scans, keyword ideas | done (stub) |
| 14 | AI answers: questions, checks, whether the Location is listed | done (stub) |
| 15 | Site health: domain audits, issues, and site fixes as Tasks (title and meta description) | done. Title fix and publishing are live-written (WordPress REST); meta description fix is stub-only (plugin-dependent) |
| 16 | Citations (six directories) and backlinks (referring domains, lost links kept) | done (stub). The product plans 18 directories |
| 17 | Articles: drafts, publishing through WordPress (`publish_post`) | drafts done (stub). Publishing: live path written, not run |

### Phase 3: Assistant platform

Not started. Pieces 18–23 as planned: assistant conversations, Skills, knowledge bases (retrieval, never training), tools that map to Actions, MCP servers, Autopilot and Undo across modules.

## Scope decision (2026-11-01)

The owner accepted the stub-first scope: **Stripe completion is skipped, and every other provider runs on its stub.** Live runs are a later step, done one provider at a time when a key is added. The items below are that later work, not part of this build.

## Later (live verification and two recorded defaults)

1. **Live runs** with real keys in a test account, one provider at a time: DataForSEO, Google Business Profile (refresh is built and unit-tested with a mocked Google), Anthropic, OpenAI, a sending provider, WordPress, Stripe test mode. Each needs its own run before it's called live.
3. **Meta description fix** is stub-only. **Decision (default, accepted until you say otherwise):** it stays stub-only until a site's SEO plugin is chosen (Yoast or Rank Math differ). The title fix is live-written.
6. **Stripe live path:** subscription updates arriving by webhook are handled; checkout has not been run against Stripe.
7. **Brand logo** is a URL. **Decision (default, accepted until you say otherwise):** no upload until a file-storage choice is made (Neon object storage or S3).

## Open questions

- Plan limits and features: a Location limit with no Plan is unlimited, while a feature with no Plan is off. Keep, or make no-Plan match everywhere?
- Whether Undo for review replies should delete the reply on Google. Today an empty reply stands in for "delete" and the live adapter doesn't implement delete.

## Changelog

- 2026-11-01: every API operation has a title (82 of 82) in the docs, and the test suite fails if one is missing or a title repeats within its group.
- 2026-11-01: API docs (/openapi) grouped: every route sits under a module tag (System, Identity, Organizations, Access, Features, Billing, Integrations, Automation, SEO) with a description. Better Auth routes are left out of the spec. Tested.
- 2026-11-01: DataForSEO split into one client and a module per API (SERP, Labs, Backlinks, AI Optimization, On-Page), with typed outputs shared with the stubs and real per-call cost. Fixed: live organic results and keyword ideas leaked DataForSEO's shapes (rankings would have read nothing); task-level errors were missed. Credentials labelled API login and API password.
- 2026-11-01: websites connect through a CMS contract (ADR 0016): typed site ops, a spec per CMS (WordPress, Webflow, Shopify, Ghost, custom webhook), connection settings column, values checked against catalog fields, publishing through the article's own website. Fixed: WordPress field names didn't match the adapter; publishing used any site connection. Migration 0003.
- 2026-11-01: code review. Fixed: member role changes and removals could grant or strip ownership (now Owner-only, one Owner kept); Location bodies could set their Organization or Google Business Profile (now an explicit field list); connections could target another Organization's Location or Website, and the WordPress lookup didn't filter by Organization; the API and worker never set `enqueue`, so queued work and low-review drafts failed outside tests; routes with a second id under `/organizations/:orgId` always returned 422 (group-level params). Added: strict config with production rules and readable errors, `loadMigrationConfig`, `/ready`, graceful shutdown, a single outbox drain at a time, constant-time secret checks, Settings → Integrations routes and the platform-LLM admin route, `noUnusedLocals`. Removed duplicated SEO gates, scope lookups and activity boilerplate.
- 2026-11-01: scope accepted by the owner: stub-first, Stripe completion skipped. Backend complete for that scope.
- 2026-11-01 (fourth pass): live WordPress title fix (page found by URL, updated through REST), live Business Profile insights (Performance API), both with mocked-fetch tests. Logo upload decision recorded as open.
- 2026-11-01 (third pass): custom Role routes (validated, compiled, refused when in use), keyword ideas route, Google token refresh (unit-tested with a mocked Google), whitelabel brand settings.
- 2026-11-01 (second pass): Partner consent (request and accept), whitelabel host lookup and brand settings, Stripe checkout route, signed provider webhooks, activity, runs and task routes, grid scans, review requests (email, metered), backlinks with lost-link history, site fixes as Tasks with WordPress, seed script, Eden test, SEO schema doc. Migrations `0001` (Partner requests, domains) and `0002` (grid, review requests, backlinks).
- 2026-11-01: built pieces 2–8 and the SEO services. Docker image builds and runs. Partitioned the three growing tables in migration 0000. Bun workspaces replace pnpm (ADR 0015).
- 2026-10-31: seventh review: metering rule: every paid per-use integration writes `usage_events`; free integrations (Search Console, GA4, Google sign-in) don't. Each provider declares `metered` in its catalog entry (ADR 0012).
- 2026-10-31: sixth review: AI billing is per-Plan configuration (`billing.plan_meters`); knowledge bases feed the assistant as context, never training.
- 2026-10-31: fifth review: LLMs are an integration (ADR 0014). Assistant platform added as phase 3.
- 2026-10-31: fourth review: "Google profile" renamed to Google Business Profile.
- 2026-10-31: third review: transfer out warns and lets the Owner revoke agency members one by one (ADR 0011).
- 2026-10-31: second review: Websites independent of Locations; access is only member rows (ADR 0011).
- 2026-10-31: review applied: Partner as an organization row; generic Plans; feature switches as jsonb; archive and immediate hard delete; Stripe not stubbed (ADR 0012, 0013).
- 2026-10-31 (`1eaa783`): area created; ADRs 0007–0013; baseline schema proposed; Neon project created.
