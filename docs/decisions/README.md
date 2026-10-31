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
