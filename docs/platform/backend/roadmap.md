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

Folded into phase 4, stage F (AI).

### Phase 4: Many Projects

Planning, not started. Decided in [0017](../../decisions/0017-one-backend-many-projects.md) and [0018](../../decisions/0018-isolation-by-process-groups-and-cells.md). The full plan, grouped by capability, with thirteen items still **to confirm**: [projects-plan.md](projects-plan.md).

| Milestone | Pieces (capability.piece) | State |
|---|---|---|
| M0. Prove the auth approach | 3.1 Project-scoped Better Auth adapter, 3.4 signed session tokens (to confirm, not tested) | planned |
| M1. OpenMarko runs as a Project | 11.1 layout · 1.1–1.4 module foundation · 2.1–2.3 Projects, keys, domains · 4.1 Project Connections · 3.2–3.4 users, Roles, tokens · 5.1–5.2 Plans and Stripe · 6.1 messaging · 2.7 templates · 8.1–8.2 console | planned |
| M2. AI platform | 7.1–7.3 AI, knowledge, widget · 9.1 limits · 10.1–10.2 key per Project, export and import | planned |
| M3. OpenChat launches | 11.3 public packages and starter · 2.4 webhooks · 2.5 Project settings API · 8.3 generated screens · 4.2 provider APIs · the OpenChat Project (`projects/openchat/`) | planned |
| M4. Safe to grow | 9.2–9.3 process groups, tagging · 5.3 profit and loss · 10.4 sale readiness | planned |
| M5. Packaged | 11.2 OpenMarko's SEO backend · 2.6 API docs · 9.4 row-level security · 10.3 cells when needed | planned |

## Scope decision (2026-11-01)

The owner accepted the stub-first scope: **Stripe completion is skipped, and every other provider runs on its stub.** Live runs are a later step, done one provider at a time when a key is added. The items below are that later work, not part of this build.

## Later (live verification and two recorded defaults)

1. **Live runs** with real keys in a test account, one provider at a time: DataForSEO, Google Business Profile (refresh is built and unit-tested with a mocked Google), Anthropic, OpenAI, a sending provider, WordPress, Stripe test mode. Each needs its own run before it's called live.
3. **Meta description fix** is stub-only. **Decision (default, accepted until you say otherwise):** it stays stub-only until a site's SEO plugin is chosen (Yoast or Rank Math differ). The title fix is live-written.
6. **Stripe live path:** subscription updates arriving by webhook are handled; checkout has not been run against Stripe.
7. **Brand logo** is a URL. **Decision (default, accepted until you say otherwise):** no upload until a file-storage choice is made (Neon object storage or S3).

## Open questions

- Decided 2026-11-06: no "no Plan"; every Project has a default Plan (projects-plan.md, 5.1).
- Decided 2026-11-06: Undo of a review reply deletes it on Google (OpenMarko; not built yet).

## Changelog

- 2026-11-06: the second Project is named OpenChat (`openchat`).
- 2026-11-06: grilling round 4: Plans per Project (console data from platform and Project Entitlement keys, seeded from `project.json`), Project limits cap Plans, widget build and abuse protection, explicit and custom model names, chat admin screens in `@platform/react`. ADR 0015 and 0010 amended for 0017.
- 2026-11-06: grilling round 3: the `chat` Project defined (assistants, skills, prompts, tools, documents, identified visitors, inbox, Plans); build order now M0 auth, M1 OpenMarko, M2 AI platform, M3 `chat`, M4 safe to grow, M5 packaged.
- 2026-11-06: grilling round 2: Kamal 2 replaces haloy; backups, Sentry, pg-boss workflow engine, workflows as JSON, `project.json` versus console ownership, Operator two-step sign-in. Second Project chosen: an embeddable AI chat widget product.
- 2026-11-06: grilling round 1 decisions recorded in projects-plan.md (stacks, jobs, automation scope, tools, Partners module, feature catalogs, default Plan, versioning, Standard Webhooks, scopes, environments, CI, R2, observability, user deletion, limits). Both open backend questions answered.
- 2026-11-06: hosting decided (VPS with haloy). Module ownership decided: Partners and whitelabel platform, Locations and Websites OpenMarko, automation generic, feature catalogs per Project.
- 2026-11-06: repository layout planned: `platform/` and `projects/<slug>/`, each with `apps/` (`api`, `worker`, `web`, `site`) and `packages/`; the console is `platform/apps/web`. Projects are separate services with their own Docker image and database, using only four public platform packages.
- 2026-11-06: phase 4 plan reviewed and regrouped by capability, built in milestones M0–M5. Added for launch speed, selling apps and no rework: `project_id` on every Project-owned table, module manifests, Project templates and domains, outgoing webhooks, a key per Project, tested export and import, profit and loss and sale readiness per Project. A secret key never acts as a user.
- 2026-11-06: platform code is unbranded (`@platform/*`); one repository; provider connections are platform capabilities and a Project's own logic is a Project module (`projects/<slug>/`) or its own backend; Operators issue scoped secret keys per Project (A1).
- 2026-11-06: the backend platform is named mkitup; OpenMarko is one Project on it. Operator added to the glossary. Console holds platform and Project settings (Plans screen added); a Project can change its own Stripe and sign-in keys (A5).
- 2026-11-06: phase 4 planned in stages (Project foundation, users and auth, console, running safely, shared services, AI, packaging) in [projects-plan.md](projects-plan.md). The Better Auth adapter approach is marked to confirm. Phase 3 folded into phase 4.
- 2026-11-05: decided the backend serves many Projects, with users per Project and isolation by process groups and cells (ADR 0017, 0018). Phase 4 planned. Glossary: Project added.
- 2026-11-06: ADR 0017 changed from a schema per Project to shared tables keyed by `project_id`, with Better Auth scoped through its database adapter (Better Auth has no native multi-tenancy; issue #1248 closed as not planned).
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
