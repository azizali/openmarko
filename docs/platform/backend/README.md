---
id: backend
kind: platform
status: idea
depends_on: []
capabilities: []
permissions: organization
code: []
related: [organizations-partners, access-roles, feature-switches, integrations, automation, app-shell]
last_verified: 1eaa783
---

# Backend

The API and worker that replace the mock's stores. API-first and headless: the app in `ui-mock/` (later the real frontend) is one client of it, and anything else can call the same API.

**Status: `idea`.** Stack and schema are decided or proposed; no code yet. See [roadmap.md](roadmap.md) for what's done piece by piece.

## What it is

- A **modular monolith**: one codebase, one folder per module, each module with its own tables, routes, jobs and events ([ADR 0008](../../decisions/0008-modules-by-feature.md)). Modules can be turned off per deployment.
- **Baseline modules** every deployment has: identity, organizations, access, features, settings, billing, integrations, automation.
- **Product modules** on top, starting with SEO.

## Where to read

| Doc | What |
|---|---|
| [technical.md](technical.md) | Stack, repo layout, module anatomy, config, how a request is checked |
| [schema.md](schema.md) | Every baseline table, conventions, how it scales |
| [projects-plan.md](projects-plan.md) | Plan for serving many Projects from one backend (planning, not built) |
| [roadmap.md](roadmap.md) | Pieces, in order, and their state |

## Decisions

[0007](../../decisions/0007-backend-stack.md) stack · [0008](../../decisions/0008-modules-by-feature.md) modules · [0009](../../decisions/0009-events-through-an-outbox.md) outbox · [0010](../../decisions/0010-envelope-encrypted-credentials.md) credentials · [0011](../../decisions/0011-partner-is-an-organization-row.md) Partner storage · [0012](../../decisions/0012-billing-module-and-plans-as-data.md) billing and Plans · [0013](../../decisions/0013-stub-or-live-providers.md) stub or live providers
