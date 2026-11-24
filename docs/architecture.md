# Architecture

One app, one database, one deploy. The API and the worker are the same code run two ways; the web app and the site are static builds that call the API over HTTP.

## Layout

```
app.config.ts        the app's name, the optional modules that are on, the feature switches
apps/
  api/               index.ts: builds the HTTP app from the enabled modules, listens on PORT
  worker/            index.ts + runner.ts: pg-boss queues, cron schedules, outbox drain loop
  web/               the product (React, Vite, Tailwind). Eden-typed calls to the API; Better Auth's client for sign-in
  site/              the marketing site (React, Vite, Tailwind). Static. Every page shares one Layout: header
                     (with the Industries menu), the closing call to action, and the footer.
modules/             one folder per module: schema.ts (its tables), module.ts (its manifest), routes.ts, services, test/
  identity           Better Auth: sign-in, sessions, Organizations, invitations; app admins
  organizations      Organizations, members, archive and delete; the platform admin area's list
  access             Roles and permissions; the caller guard
  features           feature switches per Organization
  settings           core.settings: namespaces modules declare, checked on read and write
  integrations       Connections, encrypted credentials, adapters (stub + live), invoke(), model access,
                     providers' untrimmed responses kept as files (`provider_originals`)
  messaging          the app's email: sender setting, send job, templates
  billing *          Plans, Entitlements, overrides, metering, manual and Stripe providers
  partners *         Partners and their Clients, whitelabel brand, transfer-out
  ai *               models by name, conversations, streaming chat, assistants, the chat widget, the tools a member's chat
                     may use (`toolsFor`: the modules' tools their Role allows; ADR 0036)
  knowledge *        knowledge bases, documents, ingesting, hybrid search (pgvector)
  automation *       runs, schedules, Tasks with Apply and Undo, Autopilot, the Activity log's routes
  seo *              Locations, Google Maps grids, Google search, AI answers, competitors, suggestions, SEO onboarding;
                     search data through integrations (`search.*`, `site.audit`, `places.find`, `places.details`, `profile.manage`). Needs automation.
packages/
  kernel             config (env + app.config), db, ids, errors, crypto, events (outbox), module contract,
                     the file store (`ctx.files`: a bucket or a folder), the assistant's tool contract (`AssistantTool`, `toolsOf`), activity log, Better Auth table references, the hooks optional modules fill (billing, knowledge),
                     the Drizzle migrations (drizzle/)
  shared             pure: the access model, the feature catalog, the provider catalog, metering rules
  server             composition root: the module registry, compose() (which checks and gathers the modules' tools), buildApi(), CORS,
                     the queue client, Api type
  testkit            createTestDb() (a throwaway database per test file), sessions, requester()
  chat-widget        the chat UI (floating button and panel, no dependencies): the script the ai module serves at
                     /widget/v1.js for websites, and what the web app shows its members
scripts/             migrate.ts and bootstrap.ts (release step), seed.ts (development data), reset.ts (drop, migrate, seed),
                     create-admin.ts, connect-model.ts
tooling/             dev.ts (`bun dev`), setup.ts (`bun run setup`), deploy-setup.ts (`bun run deploy:setup`). Not in the image.
```

`*` optional: a switch in `app.config.ts`. Core modules never import an optional one; they use the kernel's hooks (`billingOf(ctx)`, `knowledgeOf(ctx)`), whose defaults allow everything and know nothing.

## A request's path

1. `cors`: the browser's origin must be the app's, the site's, or one in `TRUSTED_ORIGINS`. The widget's routes allow any origin and check it per assistant.
2. `identity`: Better Auth reads the session cookie. `/api/auth/*` is Better Auth's own.
3. One of two guards: `ctx.orgGuard` for `/api/v1/organizations/:orgId/*` (a member row is required, archived Organizations refuse everyone; it builds `caller` with the Role's permission minus what the Plan removes), or `ctx.adminGuard` for `/api/v1/admin/*` (a session whose user has the `admin` role).
4. The route checks its permission: `requireAllowed(caller, resource, action)`.
5. Work goes through a service. Outside calls go through `integrations.invoke()`, which picks the Connection (the Organization's own, else the app's), checks the Plan's allowance for metered providers, calls the adapter, and records usage.
6. Changes write an Activity row and, where other modules care, an event in the outbox, in the same transaction.

Errors are always `{ code, message, details? }`: 401 no session, 403 not a member or wrong Role, 402 Plan limit, 409 `needs_connection` (with `details.needs`), 422 invalid.

## The worker

The same modules, composed without routes. pg-boss runs each module's jobs (one queue per job, retries per job), keeps cron schedules (`automation.tick` every minute starts Runs for due schedules), and a loop drains the outbox: each event's handlers run once, in a transaction with their "handled" mark. An Organization's jobs run at most `JOBS_PER_ORGANIZATION` at once.

## Data

- Postgres, one schema per module (`ai`, `billing`, `integrations`, `knowledge`, `partners`, `automation`, `seo`, `core`), plus `auth` (Better Auth's) and `pgboss`.
- `seo` also keeps a public catalog shared by every Organization (`places`, `place_snapshots`, `keyword_metrics`, and the monthly lists `place_categories` and `place_cities`): public Google facts with no `organization_id` ([data model](features/seo/data-model.md), ADR 0033).
- UUIDv7 ids made in the app. Rows that belong to an Organization reference `auth.organization` and cascade on delete.
- Better Auth's tables are created by its own migration; ours by Drizzle (`packages/kernel/drizzle`). `scripts/migrate.ts` runs both, in that order.
- Secrets (provider keys) are envelope-encrypted with `MASTER_KEY_V<n>` and stored apart from their Connection.
- Settings that aren't columns live in `core.settings`, one JSON row per scope and namespace, checked against the schema the owning module declares.

## The web app

- `src/lib/api.ts`: Eden `treaty<Api>` against the app's own origin; `/api/*` is forwarded to the API by Vite (development) or Vercel (production), so the session cookie is first-party.
- `src/lib/auth.ts`: Better Auth's React client with the organization, admin and magic-link plugins.
- `src/lib/session.tsx`: who's signed in, their Organizations, the one they're in, and `can(resource, action)` from `/caller`.
- `src/lib/session.tsx`: the person, their Organizations, and whether the open Organization is a Partner they work at. The Partner group in Settings (Clients, Whitelabel) shows only then.
- `src/lib/brand.ts`: the brand on screen (ours or a Partner's, by the Organization being worked in), loaded before the first paint and again when the Organization changes.
- `src/components/AppChat.tsx`: the floating chat widget, opened by its button or the sidebar's Sparkles, answering as the widget its Organization is offered: its own choice, its Partner's, the app's, or the built-in one (ADR 0031). The UI is `packages/chat-widget`, reading the member's conversations over HTTP (`src/lib/memberChat.ts`); the button can be dragged anywhere on the page. Loads behind `__MODULE_AI__`.
- `src/pages/Widgets.tsx`: where an Organization makes its chat widgets (each one an Assistant) and embeds them. Its preview is that same UI, laid out inside the page. **Use in the app** on a widget's page chooses it for the chat button (an app admin can also choose it for everyone; Platform admin → Models shows that choice).
- `src/components/ui.tsx`: the shared controls. Every form opens in its `Drawer`, a side panel built on a native modal `<dialog>` (ADR 0026). It also holds the shared list and navigation pieces: `Avatar`, `ItemRow`, `ItemCard`, `Disclosure`, `ChoiceCards` and `RailGroup`.
- `src/components/Feedback.tsx`: every success and failure, beside the action that caused it (`Feedback` + `useFeedback()`) or as a toast (`useToast()`), and `LoadError` for a page that couldn't load (ADR 0030). `feedback.rules.test.ts` fails a page that builds its own. `FileInput` in `ui.tsx` is the only file picker.
- `src/components/Can.tsx`: guards a control by permission, disabling it with the reason or hiding it. `src/components/RoleEditor.tsx` also exports `RoleSelect` and `AccessSummary` for showing Roles elsewhere.
- `src/pages/Settings.tsx`: one page with one rail in four groups: the open Organization, its Partner side, You, and App admin for app admins (ADR 0027).
- `src/pages/seo/`: everything SEO on one folder, behind `__MODULE_SEO__`. `Seo.tsx` is the shell (the Location chosen by `?location=`, else the last one opened; setup when there's none), draws the Rankings and Actions tabs, and gives its pages `useSeo()`; `api.ts` names the calls and infers their shapes from the API's types; `parts.tsx` holds the map grid and the small pieces the pages share; `actions.tsx` the suggestion cards the Action plan (`Plan.tsx`) and the overview share; `AddDrawers.tsx` the add panels; `Setup.tsx` is SEO onboarding (`/seo/setup`), which a new Organization lands on when the module is on.
- Pages: `pages/` for members, `pages/settings/` for Settings sections, `pages/admin/` for the App admin sections of Settings. Optional modules' pages load behind `__MODULE_X__` flags (`vite.config.ts` reads `app.config.ts`).
