# 0008. The backend is a modular monolith, one folder per module

- Status: Accepted
- Date: 2026-10-31
- Affects: platform/backend, every module

## Context

Not every deployment needs every module, and modules must still work with each other. All of a feature's code should live in one place.

## Decision

- **Kernel** (`packages/kernel`): plumbing every module shares. `defineModule()`, the database client and transactions, the event bus and outbox, the request context (session, Organization, permission check), errors, IDs, credential encryption. The kernel never imports a module.
- **Modules** (`modules/<id>/`): one folder each, holding everything about it: `module.ts` (manifest), `schema.ts` (tables), `routes/`, `services/`, `jobs/`, `adapters/`, `events.ts`, tests.
- **Each module owns one Postgres schema** (`core`, `billing`, `integrations`, `automation`, `seo`…). No module reads or writes another module's tables. It calls that module's exported service, or listens to its events.
- **A manifest** declares `id`, `dependsOn`, routes, jobs, events emitted and handled, permissions (resource actions) and capabilities.
- **Two separate on/off switches** (following [0006](0006-three-separate-checks.md)):
  - Deploy time: `ENABLED_MODULES` decides which modules are mounted, migrated and run in a deployment. Dependencies are checked at boot.
  - Per Organization: feature switches decide what an Organization uses. Routes and jobs both check them.

## Consequences

- A module can be removed, or later split into its own service, without touching others.
- Cross-module reads cost a service call instead of a SQL join. Reports that need many modules read through services or a read model.
- `apps/api` and `apps/worker` contain almost nothing: they load the enabled modules.
