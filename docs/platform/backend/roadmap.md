# Backend: roadmap

## Current state

- Neon project `openmarko` created (2026-10-31). Empty.
- Stack decided ([ADR 0007](../../decisions/0007-backend-stack.md)); baseline schema reviewed and revised ([schema.md](schema.md)).
- No code.

## Pieces

Built one at a time. Each piece ends with a review, and with this file, the module's docs and any ADR updated, so the next piece starts from the docs, not from memory.

### Phase 1: baseline

| # | Piece | State |
|---|---|---|
| 1 | Stack ADRs + baseline schema doc | done |
| 2 | Monorepo scaffold, kernel (`defineModule`, db, config, ids, errors, crypto), Docker, pg-boss-on-Bun check, health + `/openapi` | to do |
| 3 | identity + access: Better Auth, Organizations, Members, invitations, Roles compiled from `data/access.ts`, `guard()` | to do |
| 4 | organizations: Partners and Clients, Locations (with Google Business Profile ID), Websites, domains, transfer out with per-person revoke | to do |
| 5 | features + settings: feature switches (`organization.features`), scoped settings, whitelabel resolution | to do |
| 6 | billing: Plans, prices, Entitlement keys, subscriptions, Stripe + manual, webhooks, usage | to do |
| 7 | integrations: Connections, credentials, adapter registry, `invoke()`, webhooks inbox, LLM capability (`llm.complete`) with Anthropic, OpenAI, Google, OpenRouter adapters, platform default Connection and `llm.routes` settings ([ADR 0014](../../decisions/0014-llms-are-integrations-with-a-platform-default.md)) | to do |
| 8 | automation: outbox loop, Schedules ticker, Runs, Tasks with Apply/Undo, Activity | to do |
| 9 | Seed (Maple & Main, Brightline) + Eden client wired into one mock page as proof | to do |

### Phase 3: Assistant platform

The assistant grows from a chat box into an agent that learns and acts. Built after SEO, on the same baseline. Each part is its own piece with a review.

| # | Piece | State |
|---|---|---|
| 18 | `assistant` module: conversations, messages, streaming, model routing from `llm.routes` | to do |
| 19 | Skills: SKILL.md per Organization, versioned, public index, used by the assistant and writers | to do |
| 20 | Knowledge bases: documents per Organization, chunked and embedded (`llm.embed`), retrieval for the assistant | to do |
| 21 | Tools: a registry of actions the assistant may call; each tool maps to an Action and is checked by the same permission and Plan rules; output becomes a Task (Autopilot decides whether it applies) | to do |
| 22 | MCP: connect external MCP servers as Connections; their tools are offered as tools above, under the same checks | to do |
| 23 | Autopilot and Undo for assistant actions across all modules | to do |

Decided for phase 3: how AI use is sold is Plan configuration (`billing.plan_meters`); knowledge bases are retrieved as context and never used for training.

### Phase 2: SEO module

Order follows dependencies; each is one piece with its own schema review.

| # | Piece | State |
|---|---|---|
| 10 | SEO schema doc (all seven features) | to do |
| 11 | Business Profile: Google Business Profile connection, profile sync, insights, edits as Tasks | to do |
| 12 | Reviews: sync, replies, review requests, Autopilot | to do |
| 13 | Rankings & competitors: keywords, grid scans, organic, competitors, factors, keyword ideas | to do |
| 14 | AI answers | to do |
| 15 | Site health | to do |
| 16 | Citations & backlinks | to do |
| 17 | Articles | to do |

## Open questions

None.

## Changelog

- 2026-10-31: seventh review: metering rule: every paid per-use integration writes `usage_events`; free integrations (Search Console, GA4, Google sign-in) don't. Each provider declares `metered` in its catalog entry (ADR 0012).
- 2026-10-31: sixth review: AI billing is per-Plan configuration (`billing.plan_meters`: included units, overage block / charge / byok-only); knowledge bases feed the assistant as context, never training.
- 2026-10-31: fifth review: LLMs are an integration (ADR 0014): `llm.complete` capability, Organization key or platform default; assistant platform added as phase 3 (skills, knowledge, tools, MCP). Mock: `setGoogleProfile` renamed to `setGoogleBusinessProfile` to match the renamed state.
- 2026-10-31: fourth review: "Google profile" renamed to Google Business Profile in docs, Glossary and the mock's UI text; Google login (`auth.account`) and the Google Business Profile Connection are separate Google accounts.
- 2026-10-31: third review: transfer out warns and lets the Owner revoke agency members one by one (ADR 0011); a Location without a Google Business Profile is inert until connected.
- 2026-10-31: second review: Websites independent of Locations (`location_websites` removed; `locations.website_url` is display only); Google Business Profile ID and its Connection on `locations`; `organization.kind` and `member.via_partner` removed, access is only member rows (ADR 0011 rewritten).
- 2026-10-31: review applied: Partner as organization row accepted; Plans are generic Entitlement keys (`feature.*`, `action.*`, `limit.*`, `partner`), no account types; feature switches as `organization.features` jsonb; archive + immediate hard delete via cascade; Stripe not stubbed, `manual` provider added. ADRs 0011, 0012, 0013 updated.
- 2026-10-31 (`1eaa783`): area created; ADRs 0007–0013; baseline schema proposed; Neon project created.
