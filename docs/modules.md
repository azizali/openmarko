# Extending the app

## A new module

Your product's logic is a module: `modules/<id>/` with `src/schema.ts`, `src/module.ts`, `src/routes.ts`, services and `test/`.

1. `schema.ts`: tables in a Postgres schema named after the module (`pgSchema("<id>")`). Rows that belong to an Organization reference `authOrganization.id` with `onDelete: "cascade"`.
2. `module.ts`: `defineModule({ id, apiGroup, dependsOn, events, settings, permissions, roleGroups, setup })`: the manifest, and nothing but what `setup` wires up. `setup(ctx)` returns `{ routes, jobs, handlers, tools }`; routes live in `routes.ts`. `apiGroup` is the module's group in the API docs. Declare the permission resources your routes check and the events you emit: a route checking an undeclared resource, or a handler for an undeclared event, fails at boot. A resource can sit in a Role editor group from a module yours `dependsOn`, as knowledge does with ai.
3. Routes under `/api/v1/organizations/:orgId/...` use `.use(ctx.orgGuard!)` and get `caller`; check with `requireAllowed(caller, resource, action)`. Admin routes under `/api/v1/admin/...` use `.use(ctx.adminGuard!)` and get `admin`.
4. Register it in `packages/server/src/index.ts`: the `registry` and `apiShape()` (so the web app's client is typed). Add its id to `ModuleId` in `packages/kernel/src/config.ts` (core, or an `app.config.ts` switch).
5. `bun run db:generate` for the migration; `bun run db:reset` to apply it locally.
6. A page in `apps/web/src/pages/`, a route in `App.tsx`, a sidebar entry in `components/Layout.tsx`. If the module is optional, put the page behind `__MODULE_<ID>__ && import(...)`.
7. Tests in `test/`: `createTestDb()`, `ownerSession()`, `requester(buildApi(ctx, compose(ctx)))`.

Reach other modules through their `index.ts` only. Reach billing and knowledge through `billingOf(ctx)` and `knowledgeOf(ctx)`, never by import, so they can be off.

## A new provider

1. A catalog entry in `packages/shared/src/integrations.ts`: id, name, category, `attach`, `capabilities`, and the `fields` a person fills in (secret fields are encrypted; the rest become settings). A new capability goes in `capabilities` with the permission connecting it needs.
2. An adapter in `modules/integrations/src/adapters/`: `{ provider, capabilities, estimate?, call }`. `call` gets `mode` (`stub` or `live`), `secrets()` and `settings`. Always implement the stub. When a live response holds more than you read, hand it over with `keep({ ref, body })` (`ref`: the provider's id for it); `invoke()` keeps it as a file, and `readOriginal(ctx, provider, ref)` reads it back (ADR 0035).
3. Register the adapter in `adapters/index.ts`. If it costs money, a meter in `packages/shared/src/metering.ts`.
4. Call it with `invoke(ctx, orgId, "capability.id", input)`.

A provider people connect by signing in (OAuth) has `auth: "oauth"` and no fields, plus an entry in `oauthProviders` (`modules/integrations/src/oauth.ts`): its consent and token addresses, scopes, and the app's client. The web app starts it with `POST …/connections/oauth/<provider>` and sends the browser to the address it returns; the provider comes back to `/api/v1/oauth/<provider>/callback`, which stores the refresh token as the Connection's secret. Adapters get `accessToken()` in their call context. A cost the app pays but Plans don't sell is a meter with `costOnly: true`: recorded, never checked. It picks the Connection, checks the Plan, meters, and records usage.

## A feature switch

Add it to `features` in `app.config.ts`. It appears in Settings → Features for every Organization, and a Plan can grant it with `feature.<id>`. Before doing the feature's work, `assertFeatureOn(ctx, orgId, "<id>")` (module on, Plan allows, Organization switched on).

## A Task kind

`registerExecutor("<kind>", { apply, revert })` in your module's `setup`. `apply` does the change and returns what `revert` needs. Propose with `proposeTask(ctx, { kind, featureId, action, title, payload, ... })`: it waits in Automation → Tasks, or applies at once when the Organization's Autopilot says `on` for that action. The boilerplate ships `organization.rename` as the example.

## A tool for the assistant

Return it from `setup`: `{ routes, jobs, tools: [myTool] }`, each made with `defineTool({ name, description, input, requires, effect, run })` (`packages/kernel/src/tools.ts`, ADR 0036). Name it `<module id>.<verb_noun>`; `requires` is a permission your manifest (or one it depends on) declares; both are checked at boot. `effect: "read"` returns a small JSON summary from your services, scoped to `caller.orgId`. `effect: "propose"` never writes: it calls `proposeTask(..., createdByType: "assistant")` and returns `{ taskId, applied, title }`, so Autopilot decides. Throw an AppError to tell the model why not. Members whose Role lacks `requires` are never offered it. Automation's `tools.ts` has one of each.

## A job

Return it from `setup`: `{ name, run, retry?, cron?, perOrganization? }`. Queue it with `ctx.enqueue(name, data, { organizationId })`. A schedule (`setSchedule`) can run it per Organization on a cadence; the Run it starts shows in Automation → Runs with its cost.

## An app setting

Declare it in the manifest: `settings: [{ id, label, schema (zod), scopes: ["app"] }]`. It appears as a form in Settings → App admin → App settings, built from the schema. Read it with `readAppSetting(ctx, id)`. Scope `organization`, `partner` or `user` works the same with `readSetting`/`writeSetting`.

## An email template

Add the template name to `OutgoingEmail["template"]` in `packages/kernel/src/module.ts` and its text to `modules/messaging/src/templates.ts`. Send with `ctx.email({ to, template, data })`; it's queued and retried, and skipped (false) while the app can't send yet.
