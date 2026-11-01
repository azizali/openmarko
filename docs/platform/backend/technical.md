# Backend: technical

Planned. Nothing here exists in code yet; [roadmap.md](roadmap.md) tracks what does.

## Stack

Bun · Elysia (TypeBox schemas, OpenAPI, Eden Treaty client) · Drizzle · Postgres 17 on Neon · Better Auth (organization plugin, dynamic access control) · pg-boss · Docker. Why: [ADR 0007](../../decisions/0007-backend-stack.md).

## Services

| Service | Where | Runs |
|---|---|---|
| Frontend | Vercel | the app; `/api/*` forwarded to the backend so cookies stay first-party on every whitelabel domain |
| Backend | Fly.io or a VPS, one image | `api` (Elysia + Better Auth) and `worker` (pg-boss jobs, schedules, outbox loop) |
| Database | Neon project `openmarko` (`wandering-paper-07929606`, aws-us-west-2), database `openmarko` | data, pg-boss queue, outbox |

## Repo layout

```
apps/
  api/          # loads enabled modules → Elysia app, /openapi
  worker/       # loads enabled modules → job handlers, schedule ticker, outbox loop
packages/
  kernel/       # defineModule, db, tx, events/outbox, request context, errors, ids, crypto, config
  shared/       # server-importable catalogs moved from ui-mock/src/data: access, features, integrations
modules/
  identity/  organizations/  access/  features/  settings/
  billing/  integrations/  automation/
  seo/          # later
```

## Module anatomy

```
modules/<id>/
  module.ts      # manifest
  schema.ts      # Drizzle tables, all in pgSchema('<id or owner schema>')
  routes/        # Elysia plugins, one file per resource
  services/      # the module's public functions; other modules import only these (via index.ts)
  jobs/          # pg-boss handlers and schedule definitions
  events.ts      # events it emits (typed) and handlers for events it listens to
  adapters/      # provider adapters, live/ and stub/ (ADR 0013)
  index.ts       # public surface: the manifest, services, event types
  *.test.ts
```

```ts
export default defineModule({
  id: "seo",
  dependsOn: ["organizations", "integrations", "automation"],
  features: ["seo", "rankings", "reviews"],          // FeatureIds it serves
  routes: [locationsRoutes, reviewsRoutes],
  jobs: { "seo.profile-sync": profileSync },
  emits: ["review.received"],
  handles: { "location.created": onLocationCreated },
});
```

Rules:
- A module never imports another module's `schema.ts`. It uses that module's `services` or its events.
- A module's tables live in its own Postgres schema.
- `ENABLED_MODULES` (comma list, default all) decides what loads. Boot fails if a module's `dependsOn` isn't loaded.

## Every request

1. Resolve the **Partner** from the host (`core.domains`) for whitelabel.
2. **Session** (Better Auth) → user, active Organization.
3. **Feature on?** Plan has `feature.<id>`, and `organization.features` + module + `needsAny` ([ADR 0006](../../decisions/0006-three-separate-checks.md)).
4. **Plan allows the Action and the limit?** Entitlements ([ADR 0012](../../decisions/0012-billing-module-and-plans-as-data.md)).
5. **Role allows?** `hasPermission({ resource: [action] })`, minus any `action.*` the Plan removes ([ADR 0003](../../decisions/0003-roles-compile-to-better-auth.md)).
6. **Connected?** Checked by the route that needs a capability; returns `409 { needs: capability }` so the UI shows Connect.

Routes declare 3–5 in one line: `guard({ feature: "reviews", permission: ["reviews", "post"] })`. Jobs run 3 and 4 before doing work.

## Config

| Var | Meaning |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `ENABLED_MODULES` | which modules load |
| `PROVIDERS` / `PROVIDERS_LIVE` | `stub` (default) or `live`, overridable per provider (not Stripe: always real) ([ADR 0013](../../decisions/0013-stub-or-live-providers.md)) |
| `MASTER_KEY_V1` (…`_V2`) / `MASTER_KEY_CURRENT` | credential master keys ([ADR 0010](../../decisions/0010-envelope-encrypted-credentials.md)) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | auth |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | live billing |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | live SEO data |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth (login and Business Profile) |

## Schema

[schema.md](schema.md).
