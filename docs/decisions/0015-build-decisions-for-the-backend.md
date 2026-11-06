# 0015. Build decisions made while implementing the backend

- Status: Accepted
- Date: 2026-11-01
- Affects: platform/backend, every module
- Amends: [0007](0007-backend-stack.md) (package manager), [0011](0011-partner-is-an-organization-row.md) (Client consent is not built)

## Context

Writing the baseline and the SEO module against the real libraries showed details the earlier decisions didn't cover. Each one below was found by running the code, not guessed.

## Decision

1. **Bun workspaces, not pnpm.** pnpm 11 blocks dependency build scripts by default, and allowing them needs an interactive step. Bun is already the runtime, so `bun install` with `workspaces` in the root `package.json` does the job. Turborepo is not used; the scripts are plain `bun` commands.
2. **Better Auth's ids are text; ours are UUIDv7.** Better Auth creates `text` id columns. We set its id generator to UUIDv7, so the values look the same, but every column that points at a Better Auth row (`organization_id`, `user_id`, `partner_id`, `created_by`…) is `text`. Postgres won't make a foreign key between `uuid` and `text`.
3. **Better Auth's columns keep Better Auth's names.** `organizationId`, `userId`, `partnerId`, `archivedAt`, `createdAt` are camelCase in its tables. Our reference definitions in `packages/kernel/src/auth-refs.ts` use those exact names. Our own tables stay snake_case.
4. **Drizzle never creates Better Auth's tables.** `auth.*` references live in a file outside drizzle's schema glob. Better Auth's own migration creates the tables, and it runs first (`scripts/migrate.ts`).
5. **Each module's `setup(ctx)` builds what it needs.** Modules are functions of one shared `AppContext`, not static objects. The caller guard (`ctx.orgGuard`) is built by the composition root (`packages/platform`), because it needs sessions and so depends on identity. Modules never import the guard; they use it.
6. **Routes check the Plan, then the Role, then the feature.** Feature switches return 403 `feature_off`; permission failures return 403 naming the role; a missing provider returns 409 `needs_connection` naming the capability. One error shape for all: `{ code, message, details? }`.
7. **An outbox event is handled in the same transaction as its mark.** Each handler claims `(event, handler)` in `core.outbox_handled` and runs inside the transaction that marks the event processed. Its database writes commit exactly once. Calls to outside providers are at-least-once and must be repeat-safe.
8. **Hard delete runs cleanup hooks before the cascade.** Credentials are removed by the cascade, so revocation can't run after it. Hooks are idempotent.
9. **Monthly partitions in the first migration.** `core.activity`, `billing.usage_events` and `seo.rank_snapshots` are `PARTITION BY RANGE` from migration 0000, with a default partition and `public.ensure_month_partitions()`, which the daily `automation.partitions` job calls. Drizzle doesn't express partitions, so the migration file was edited by hand before the first deploy. Any later change to these tables must follow the same pattern.
10. **Metering goes through one function.** `invoke()` checks the Plan's allowance before a paid call, records usage after it, and stores the run id so a run's cost is the sum of its usage. Free providers have no `metered` entry and write no usage.
11. **Stubs are deterministic.** The same input gives the same output, so tests can assert on them. Live adapters exist for DataForSEO (two endpoints), Anthropic, OpenAI and Google Business Profile (reviews and reply), written from the endpoints in the mock. They have not been run against the live APIs.

## Consequences

- Several earlier docs said `uuid` and snake_case everywhere, and `pnpm` and Turborepo. [schema.md](../platform/backend/schema.md) and [technical.md](../platform/backend/technical.md) now say what is built.
- Client consent is built: a Partner requests, and the Client's owner accepts or declines.
- Typed client: each module exports its route factory. `packages/platform` `apiShape` lists them all, type-only, so Eden sees every route whatever `ENABLED_MODULES` says at runtime.
- Custom Role permissions are recompiled from their saved spec on every check, so a new feature reaches existing roles.
- The Partner-facing "agency member" model works as described in [0011](0011-partner-is-an-organization-row.md), with the transfer-out preview and per-person revoke.

## Amendments

- 2026-11-06, by [0017](0017-one-backend-many-projects.md): point 4 changes. Better Auth still creates its tables, but our migrations now add `project_id` to them and replace Better Auth's global unique constraints (email, sign-in account) with per-Project ones.
