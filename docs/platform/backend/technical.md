# Backend: technical

Built and tested at `bun test` (196 tests, 0 failing). What is **not** built is listed in [roadmap.md](roadmap.md). Stack and reasons: [ADR 0007](../../decisions/0007-backend-stack.md). Build decisions: [ADR 0015](../../decisions/0015-build-decisions-for-the-backend.md).

## Services

| Service | Where | Runs |
|---|---|---|
| Frontend | Vercel | the app; `/api/*` forwarded to the backend, so cookies stay first-party |
| Backend | Fly.io or a VPS, one image | `apps/api` (HTTP) and `apps/worker` (jobs, schedules, outbox). The image's default command is the API. |
| Database | Neon project `openmarko` (`wandering-paper-07929606`, aws-us-west-2) | data, pg-boss queue (schema `pgboss`), outbox |

## Repo layout

```
apps/
  api/        index.ts: builds the HTTP app from the enabled modules, listens on PORT
  worker/     index.ts + runner.ts: pg-boss queues, cron schedules, outbox drain loop
packages/
  kernel/     config, db, ids (UUIDv7), errors, crypto (envelope), events (outbox), module contract,
              activity log, Better Auth references, the Drizzle migrations (drizzle/)
  shared/     the access model (Roles, Actions, compile), feature catalog, integration catalog,
              metering rules, requireAllowed(). Pure: no database, no HTTP.
  platform/   composition root: the module registry, compose(), buildApi()
  testkit/    createTestDb() (throwaway database per test file), ownerSession(), requester()
modules/
  identity/       Better Auth (sign-in, sessions, organizations, invitations)
  access/         permission resolution (Role grant minus Plan removals), the caller guard
  features/       feature switches: statusOf(), assertFeatureOn()
  settings/       core.settings: namespaces validated by their module
  billing/        Plans, Entitlements, overrides, metering, manual + Stripe providers
  organizations/  Organizations, Locations, Websites, Partners/Clients, transfer-out, archive, delete
  integrations/   connections, encrypted credentials, adapters (stub + live), invoke()
  automation/     schedules, runs, tasks (Apply/Undo, Autopilot), the tick and partition jobs
  seo/            Business Profile, reviews, rankings, AI answers, site health, citations, articles
scripts/migrate.ts   Better Auth migration, then Drizzle migrations. Run once per release.
```

Each module folder holds its `schema.ts` (its tables, in its own Postgres schema), `module.ts` (what it adds), services, routes and `test/`. Modules import each other only through their `index.ts`.

## Request path

1. `identity`: Better Auth reads the session cookie (`/api/auth/*` is Better Auth's own routes).
2. `access` (`ctx.orgGuard`, for routes under `/organizations/:orgId`): membership row required (ADR 0011), archived Organizations refused. Builds `caller` with its permission: the Role's grant minus `action.*` the Plan removes.
3. The route checks its feature (`assertFeatureOn`: Plan, Organization switch, module, `needsAny`).
4. The route checks its action (`requireAllowed(caller, resource, action)`).
5. Work goes through a service. Outside calls go through `integrations.invoke()`, which checks connection, metering and the Plan allowance.

Errors: every failure is `{ code, message, details? }`. 401 no session, 403 not a member, wrong role, or feature off (`feature_off`), 402 Plan limit, 409 `needs_connection` (with `details.needs`), 422 invalid.

## Events and jobs

- `emit(tx, event)` writes an outbox row in the caller's transaction. The worker drains it every second. Each handler runs with its "handled" mark, in one transaction. A failing handler retries with backoff, up to 12 attempts.
- Handlers registered: `review.received` → `seo.low-rating-draft` (queues a reply draft for ratings of 2 or less).
- Provider webhooks: `POST /api/v1/webhooks/:provider`, signed with `x-openmarko-signature` (HMAC-SHA256, secret in `WEBHOOK_SECRET_<PROVIDER>`). Refused when no secret is set. Stored once per provider event id.
- Jobs (pg-boss): `automation.tick` (every minute: starts a Run for each due schedule), `automation.partitions` (daily), `seo.profile-sync` (6-hourly), `seo.rank-scan` (daily), `seo.ai-check` (weekly), `seo.audit` (weekly), `seo.citation-check` (weekly), `seo.review-reply-draft` (on demand). Each checks its feature and records a Run.

## Config

Every variable is listed, with how to generate it, in [`.env.example`](../../../.env.example). All of them are parsed in one place, `packages/kernel/src/config.ts`, at boot. A bad value stops the process with a list of every problem (`ConfigError`), so a deploy fails before it serves a request. Nothing else reads `process.env` (the test harness reads `TEST_DATABASE_URL`).

| Rule | Where |
|---|---|
| `DATABASE_URL` is a postgres URL; `BETTER_AUTH_SECRET` and `PLATFORM_ADMIN_TOKEN` are 32+ characters; `PORT` is 1–65535 | kernel config |
| `MASTER_KEY_V<n>` are 32 bytes base64; `MASTER_KEY_CURRENT` must point at one | kernel config |
| `TRUSTED_ORIGINS` are bare origins; Stripe keys and webhook secrets have the right prefix; `GOOGLE_CLIENT_ID` and `_SECRET` come together | kernel config |
| Production: `BETTER_AUTH_URL` and every trusted origin are https; at least one trusted origin | kernel config |
| Every name in `PROVIDERS_LIVE` is a known provider; Google Business Profile live needs the Google client | `checkProviders` in platform (needs the catalog) |
| Blank values (`KEY=`) count as unset | kernel config |

Migrations use `loadMigrationConfig`: only the database and auth settings, no master keys or provider secrets.

## Processes

| Process | Command | Does |
|---|---|---|
| API | `bun apps/api/src/index.ts` | HTTP. Sends jobs to the queue (it never runs them). `GET /health` is liveness; `GET /ready` checks the database. Stops gracefully on SIGTERM. |
| Worker | `bun apps/worker/src/index.ts` | Runs jobs and cron schedules, drains the outbox (one drain at a time). Event handlers can queue follow-up jobs. Stops gracefully on SIGTERM. |
| Migrate | `bun scripts/migrate.ts` | Release step, before the new API and worker start. |

Both API and worker use `startQueue` (`packages/platform/src/queue.ts`) so they agree on queue names.

## Security rules the code keeps

- **Ownership:** only an Owner grants or removes ownership, changes an Owner's role or removes an Owner. An Organization always keeps one Owner. A role must exist (built in, or one of the Organization's custom Roles).
- **No mass assignment:** route bodies list exactly the fields a person may set. A Location's Organization, Google Business Profile link and archive state change only through their own flows.
- **Tenant isolation:** a Connection may only target the caller's own Organization, Location or Website. Lookups that resolve a connection by target also filter by Organization.
- **Secrets:** compared in constant time (`safeEqual`); webhook signatures are HMAC-SHA256 (`hmacHex`). Malformed request bodies are 400, never 500.
- **Route params:** declared per route with `ids(...)` (kernel). Elysia rejects path params a schema doesn't list, so a group-level schema breaks nested routes.

## Running locally

```sh
bun install
export DATABASE_URL=postgres://postgres:dev@localhost:5433/openmarko BETTER_AUTH_SECRET=... MASTER_KEY_V1=$(openssl rand -base64 32)
bun scripts/migrate.ts          # migrations
bun apps/api/src/index.ts       # API on PORT (OpenAPI at /openapi)
bun apps/worker/src/index.ts    # jobs
bun test                        # needs TEST_DATABASE_URL or a Postgres on localhost:5433
```

The container image (`Dockerfile`) runs the same commands. Run `bun scripts/migrate.ts` as a release step before the new API and worker start.

## Data

Tables by module are in [schema.md](schema.md). Conventions that differ from the schema doc's first draft, after building:

- Better Auth's tables and every column that points at them use `text` ids (ADR 0015). Our own rows use UUIDv7.
- Better Auth's columns keep its camelCase names. Our references to them are in `packages/kernel/src/auth-refs.ts`.
- Three tables are monthly partitions from migration 0000: `core.activity`, `billing.usage_events`, `seo.rank_snapshots`.

## Tooling

| Command | What |
|---|---|
| `bun run check` | lint, format check, type check and tests, in that order. Run before every commit. |
| `bun run lint` | oxlint (`.oxlintrc.json`). |
| `bun run format` | oxfmt (`.oxfmtrc.json`). `format:check` only reports. |
| `bun run typecheck` | TypeScript, with unused locals and parameters reported as errors. |

`no-await-in-loop` is off on purpose: metered provider calls, outbox handlers and per-item transactions run one at a time, so cost, ordering and retries stay predictable.

## Tests

`bun test` runs 196 tests: pure unit tests (encryption, roles, feature switches, Stripe signatures, domains, cadence, config, module order) and database tests, each on its own migrated database (outbox exactly-once, entitlements and metering, connections and secrets, tasks with Undo and Autopilot, transfer-out, archive and hard delete, SEO flows, the HTTP guard and the feature switch on real routes, OpenAPI).

## Known gaps

See [roadmap.md § Still to build](roadmap.md#still-to-build). The ones that matter most: live provider adapters have not been run against the real APIs; the meta description fix is stub-only (depends on each site's SEO plugin); logo upload is not built (storage not chosen).

**Typed client.** `packages/platform` exports `apiShape` (type only) and `Api`. Frontends call `treaty<Api>(url)`. `apiShape` must list every module's route factory: when a module is added, add it there too. A type probe in review confirmed that a wrong response type is rejected.
