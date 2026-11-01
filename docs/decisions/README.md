# Decisions

Architecture decision records. One decision per file, numbered in order: `NNNN-short-title.md`. Never renumber; mark a replaced ADR `Superseded by NNNN`.

The first six were written on 2026-10-31 to record decisions already made in the mock's code comments, not new ones.

| # | Decision | Status |
|---|---|---|
| [0001](0001-mock-first.md) | Build the product as a clickable mock first | Accepted |
| [0002](0002-capabilities-not-providers.md) | Features depend on Capabilities, never on a Provider | Accepted |
| [0003](0003-roles-compile-to-better-auth.md) | Roles are levels that compile to Better Auth permissions; no per-person exceptions | Accepted |
| [0004](0004-whitelabel-per-partner.md) | Whitelabel is per Partner and belongs to the session | Accepted |
| [0005](0005-one-task-store.md) | The assistant, To-do and Autopilot share one task model | Accepted |
| [0006](0006-three-separate-checks.md) | Feature switches, permissions and connections are separate checks | Accepted |
| [0007](0007-backend-stack.md) | Backend stack: Bun, Elysia, Drizzle, Neon, Better Auth, pg-boss | Accepted |
| [0008](0008-modules-by-feature.md) | The backend is a modular monolith, one folder per module | Accepted |
| [0009](0009-events-through-an-outbox.md) | Modules announce events through an outbox table | Accepted |
| [0010](0010-envelope-encrypted-credentials.md) | Provider credentials are envelope-encrypted, apart from Connections | Accepted |
| [0011](0011-partner-is-an-organization-row.md) | A Partner is an Organization; access is only member rows | Accepted |
| [0012](0012-billing-module-and-plans-as-data.md) | Billing is our own module; Plans and Entitlements are data | Accepted |
| [0013](0013-stub-or-live-providers.md) | Every provider adapter has a stub, chosen by config | Accepted |
| [0014](0014-llms-are-integrations-with-a-platform-default.md) | LLMs are an integration; the platform provides a default | Accepted |

## Template

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Affects: features/…, platform/…

## Context
## Decision
## Consequences
```
