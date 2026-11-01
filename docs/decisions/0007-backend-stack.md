# 0007. Backend stack: Bun, Elysia, Drizzle, Neon, Better Auth, pg-boss

- Status: Accepted
- Date: 2026-10-31
- Affects: platform/backend, everything that moves off the mock

## Context

The mock ([ADR 0001](0001-mock-first.md)) is ready to be backed by a real service. The backend must be API-first and headless: the UI is one client of it, not part of it. Several choices were already made in earlier ADRs: Better Auth for roles ([0003](0003-roles-compile-to-better-auth.md)), credentials kept server-side, and `data/*.ts` files the server can import.

## Decision

| Layer | Choice |
|---|---|
| Runtime | Bun, TypeScript everywhere |
| Repo | Bun workspaces (amended from pnpm + Turborepo, see [0015](0015-build-decisions-for-the-backend.md)) |
| API | Elysia. Route schemas use Elysia's `t` (TypeBox); OpenAPI from `@elysiajs/openapi`; typed client with Eden Treaty |
| Database | Postgres 17 on Neon (project `openmarko`), one branch per environment |
| ORM / migrations | Drizzle + drizzle-kit |
| Auth, Organizations, roles | Better Auth (self-hosted in the API), organization plugin with dynamic access control |
| Payments | Our own billing module with a Stripe adapter ([0012](0012-billing-module-and-plans-as-data.md)) |
| Jobs, schedules | pg-boss (queue tables live in Postgres, schema `pgboss`) |
| Events between modules | Typed in-process bus plus an outbox table ([0009](0009-events-through-an-outbox.md)) |
| Secrets | Envelope-encrypted credentials table ([0010](0010-envelope-encrypted-credentials.md)) |
| Tests | `bun test` against a throwaway database per test file (`packages/testkit`) |
| Deploy | One Docker image (`oven/bun`) with two processes: `api` and `worker` |

Three services: the frontend on Vercel, the backend on Fly.io or a VPS, and the database on Neon. Vercel forwards `/api/*` to the backend, so the browser always calls its own domain. This keeps login cookies working on whitelabel domains ([0004](0004-whitelabel-per-partner.md)). The backend reads the original host to pick the Partner.

## Consequences

- No Redis or message broker to run. Postgres holds data, queue and outbox.
- pg-boss runs on Bun through the `pg` driver. Confirmed while building (pg-boss 12 on Bun 1.4): jobs, cron schedules and graceful stop all work.
- Hono was considered and dropped in favour of Elysia (owner's preference, Bun-native).
