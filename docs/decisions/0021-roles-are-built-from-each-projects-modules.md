# 0021. Roles are built from each Project's modules

- Status: Superseded by [0022](0022-a-boilerplate-not-a-platform.md)
- Date: 2026-11-07
- Affects: platform/access-roles, platform/identity, every module
- Amends: [0003](0003-roles-compile-to-better-auth.md) (where the Actions come from)
- Builds on: [0017](0017-one-backend-many-projects.md) (many Projects), projects-plan.md 1.2 (module manifests)

## Context

ADR 0003 has every feature and Organization area declare its Actions, and Roles compile against that list. Until piece 3.3 the list was one constant in `@app/shared`, copied from OpenMarko's mock: 23 OpenMarko features (social, ads, customers, the assistant and the rest) plus the Organization areas. That list was wrong for a platform serving many Projects in two ways. A Project without the SEO module still had `reviews` in its Better Auth statement and in every Role. And most entries had no module behind them, so the backend offered permissions for things it can't do.

## Decision

1. **Modules declare their resources.** A module's manifest lists the permission resources its routes check, each with its Actions (id, label, tier, `ownerOnly`) and the Role editor group it sits in. Modules may also declare groups. Boot fails on an undeclared group, a resource with no Actions, a repeated Action, an unknown tier, or a resource two modules claim.
2. **Who owns what.** `identity` declares Better Auth's own resources (`organization`, `member`, `invitation`, `team`, `ac`) and the `organization` group, because Better Auth's endpoints check them. `organizations` declares `setup`, `billing` declares `billing`, `automation` declares `autopilot` and `activity`, and `seo` declares its seven features and the `seo` group.
3. **A Project's catalog is its modules' resources.** `accessFor(ctx, project)` returns the resources and groups of the modules the Project uses. Each Project's Better Auth instance gets its own statement and preset Roles from it, and is rebuilt when the Project's modules change. A caller's permission is compiled against it. A custom Role may only name that Project's resources, groups and Actions.
4. **Presets stay platform-wide.** Owner, Admin, Editor and Viewer are the same specs everywhere; a resource or group a preset names that the Project lacks is ignored.
5. **No entry without a module.** Resources with no module behind them (OpenMarko's social, ads, customers, prospecting, brand voice and assistant features) are not in the backend. Each comes back with its module, or through `project.json` once a Project backend declares its own (11.2, 2.7). The mock keeps its own copy of the full model.

## Consequences

- Better Auth accepts a statement per instance: its own Role endpoint refuses a resource outside the instance's statement (`INVALID_RESOURCE`). That closes "to confirm" item 7 in the plan.
- A stored custom Role keeps working when a Project gains or loses a module: grants are recompiled from the saved spec, and names the Project lacks are ignored. Better Auth's stored `permission` copy is refreshed the next time the Role is saved.
- A provider whose capability needs a resource the Project doesn't have can't be connected there (403). Today that is every provider for an unbuilt OpenMarko feature.
- `Resource` is a string, not a union of literals, so a misspelt resource in a route check is not a type error. It fails closed (403), and the access tests cover the routes.
