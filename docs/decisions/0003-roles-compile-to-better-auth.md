# 0003. Roles are levels that compile to Better Auth permissions

- Status: Accepted
- Date: 2026-10-31 (recorded)
- Affects: platform/access-roles, every feature

## Context

Businesses need roles like "Front desk" or "Social media manager" without ticking hundreds of boxes, and new features shouldn't require editing every role.

## Decision

Every feature and Organization area declares **Actions**, each at a tier: view → edit → publish → manage. A **Role** sets a level per group (module), optionally per resource (a level or an exact action list), and a base level for the rest. Roles **compile** to Better Auth's `{ resource: actions[] }` permission. Owner, Admin, Editor and Viewer are built-in presets; custom roles are Better Auth dynamic roles with the spec saved beside them. A Member has exactly one Role, with **no per-person exceptions**.

## Consequences

- A new feature picks up its module's level in every role automatically (recompile).
- Checks are fine-grained (`reviews.post`) while editing stays a handful of clicks.
- Some actions are `ownerOnly` (delete organization, change billing).
- Better Auth's own resources (`member`, `invitation`, `team`, `ac`, `organization`) use its action names so its endpoints are guarded by the same roles.
