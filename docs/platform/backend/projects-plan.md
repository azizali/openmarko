# Many Projects: plan

Status: **planning**. Nothing here is built. Decisions are in [ADR 0017](../../decisions/0017-one-backend-many-projects.md) (one backend, many Projects, shared tables) and [ADR 0018](../../decisions/0018-isolation-by-process-groups-and-cells.md) (process groups, cells, bulkheads). Items marked **To confirm** must be checked before the piece that depends on them is built; none of them has been tested.

## Goal

The backend platform is **mkitup**: one backend that many of the owner's applications use. Each application is a **Project**; OpenMarko is one of them. mkitup is the product's name only; in code the platform is unbranded (`@platform/*`). Everything stays in this one repository.

What the plan optimises for, in order:

1. **Speed in launching apps.** A new Project starts from a template with sign-in, Organizations, Roles, billing, email and AI working. Launching is: copy a template, add a domain, add Stripe and Google keys.
2. **Selling apps one at a time.** Any Project can be exported with its data, code and accounts and handed to a buyer, without anything belonging to another Project.
3. **Adding things without scripts or schema rework.** A new Project is rows. A new module is its own tables and a manifest; the platform's rules, the console and the API keys pick it up from the manifest.
4. **Outside developers later, without a redesign.** Not built now, but nothing in the plan blocks it.

## What the platform holds, and what a Project holds

- **The platform** holds what any Project might reuse: sign-in, Organizations, Roles, billing, email, AI, knowledge, automation, and **connections to providers** (DataForSEO, Google Business Profile, Search Console, WordPress and other CMSs, LLMs, email providers). Provider calls are offered as capability APIs, run with the Project's or the Organization's Connection, and metered in `usage_events`.
- **A Project** holds its own use case: OpenMarko's rankings scans, review reply Tasks, site audits and fixes, articles. It lives in `projects/<slug>/` with its own backend, frontend and other code, its own Docker image and **its own database**.
- A Project reaches the platform only over HTTP: its backend calls the API with a secret key (2.1), hears about events through outgoing webhooks (2.4), and checks who is signed in with the platform's signed session tokens (3.4). In code it uses only the platform's public packages. So a Project deploys on its own, and can later move to its own repository or be sold without untangling anything.
- Cost of this choice: a network call between a Project and the platform, and no database transaction across both. If a Project ever needs tighter coupling, an in-process Project module can be added then.

## Repository layout

```
/
├─ platform/
│  ├─ apps/
│  │  ├─ api/            # Elysia HTTP server
│  │  ├─ worker/         # jobs, outbox, outgoing webhooks
│  │  └─ web/            # the console: Operator UI (React)
│  ├─ modules/           # identity, organizations, access, billing, integrations,
│  │                     # messaging, ai, knowledge, automation
│  ├─ packages/
│  │  ├─ kernel/         # internal: config, db, table helper, manifest, crypto
│  │  ├─ server/         # internal: wires modules together
│  │  ├─ testkit/        # internal
│  │  ├─ client/         # public  @platform/client: typed API client
│  │  ├─ sdk/            # public  @platform/sdk: session check, webhook check, config, logger
│  │  ├─ react/          # public  @platform/react: sign-in, billing, chat hooks and components
│  │  └─ chat-widget/    # public  embeddable script
│  ├─ migrations/
│  ├─ docs/
│  └─ Dockerfile         # one image, run as api / api-ai / worker
│
├─ projects/
│  └─ openmarko/
│     ├─ apps/
│     │  ├─ api/         # OpenMarko backend (SEO workflows, from modules/seo)
│     │  ├─ worker/      # its own jobs, if any
│     │  ├─ web/         # product frontend (today's ui-mock)
│     │  └─ site/        # marketing site (today's site/)
│     ├─ packages/       # OpenMarko-only shared code
│     ├─ migrations/     # its own database
│     ├─ project.json    # template: modules, Plans, Roles, sign-in; seeded into the platform
│     ├─ docs/
│     ├─ Dockerfile
│     └─ .env.example    # PLATFORM_URL, sk_proj_ dev key
│
├─ tooling/              # dev runner, import-boundary lint rules, tsconfig base, new-project script
├─ docker-compose.dev.yml  # Postgres + Mailpit (catches dev email)
├─ package.json          # Bun workspaces: platform/**, projects/**
└─ CLAUDE.md             # points to platform/docs and projects/*/docs
```

`apps/` holds what runs (`api`, `worker`, `web`, `site`) under the same names in the platform and in every Project. `packages/` holds shared code.

**Dependency rules**, checked by a lint rule on every run:

| From | May import | Never |
|---|---|---|
| Project code | `@platform/client`, `@platform/sdk`, `@platform/react`, `@platform/chat-widget` | `platform/modules/*`, `kernel`, `server` |
| Platform code | its own packages | anything in `projects/` |
| One Project | itself | another Project |

The four public packages are versioned, so moving Projects to another repository later only means publishing those four to a private registry.

**Project code.**
- Backends use the platform's stack (Bun, Elysia, Drizzle); the starter is written once. A Project may deviate if it has a reason.
- Frontends (`web`) use React, Vite, Tailwind and React Router. A marketing `site` is prerendered to static HTML when search ranking matters (OpenMarko's does).
- A Project's own background jobs run on its own pg-boss queue in its own database. The platform's automation is for workflows across tools, Tasks, Apply and Undo, and Autopilot.

**Deployment.** On a VPS with Kamal 2. The platform is one Docker image run as `api`, `api-ai` and `worker`, with the `platform` database. Each Project is its own Docker image for its backend, with its own database in the same Neon project (for OpenMarko, a database named `openmarko`). Frontends are static builds on Vercel or a CDN.

**Dev mode.**
- `bun dev` starts the platform (api, worker, web), with Postgres and Mailpit from `docker-compose.dev.yml`.
- `bun dev <slug>` starts the platform plus that Project's apps.
- The seed creates each Project with fixed dev keys, so `.env.example` works as it is.
- Each Project gets `api.<slug>.localhost` in dev; browsers resolve `*.localhost` to the machine, so finding the Project by domain works locally.
- `bun test` runs at the root or inside any one folder.

## Module ownership

Where each of today's modules goes.

| Today | Goes to | Notes |
|---|---|---|
| identity, access, settings, billing, integrations | platform | |
| organizations | **split** | Organizations and Members stay in `organizations`. **Partners, Clients, consent and whitelabel** become a separate platform module, `partners`, that a Project turns on; Partner whitelabel domains belong to a Project. **Locations and Websites** move to OpenMarko. |
| automation | platform, made generic | An engine for workflows that call any tool (platform capabilities, module actions, and tools a Project backend declares), with runs, schedules, retries, Tasks, Apply and Undo, and Autopilot as generic steps. Built on pg-boss and the existing runs and Tasks tables (each step a job, progress in Postgres). Workflows are stored as JSON data (steps that call tools, inputs mapped from earlier steps, conditions, approval points), written by developers with a typed TypeScript builder; a visual builder for end users can edit the same data later. |
| features | platform | The switch mechanism is the platform's; each Project declares its own feature catalog in `project.json` (version-controlled, shown read-only in the console). Organizations switch features within it; Plans grant them. |
| seo | OpenMarko | Provider calls stay in the platform's integrations (4.2); workflows move to `projects/openmarko/apps/api`. |
| messaging, ai, knowledge | platform (new) | |

Connections and site writes (ADR 0016) target Locations and Websites today. Once those are OpenMarko's, a platform Connection points at a Project's resource by type and id (`resource_type = 'openmarko.location'`, `resource_id`), with no foreign key into the Project's database. The Project deletes the Connection when it deletes the resource.

## Capabilities at a glance

| # | Capability | Pieces |
|---|---|---|
| 1 | Module foundation | 1.1 table helper · 1.2 module manifest · 1.3 settings from manifests · 1.4 two-Project tests |
| 2 | Projects and API access | 2.1 Projects and keys · 2.2 resolve the Project per request · 2.3 Project domains · 2.4 outgoing webhooks · 2.5 Project settings API · 2.6 API docs and versioning · 2.7 templates and admin API |
| 3 | Users and auth | 3.1 confirm the Better Auth adapter · 3.2 users per Project · 3.3 Organizations, Members and Roles per Project · 3.4 signed session tokens for Project backends |
| 4 | Connections and providers | 4.1 Project-level Connections · 4.2 capability APIs for providers |
| 5 | Billing | 5.1 Plans per Project · 5.2 Stripe per Project with hosted pages · 5.3 profit and loss per Project |
| 6 | Messaging | 6.1 messaging module |
| 7 | AI | 7.1 AI module · 7.2 knowledge · 7.3 chat widget |
| 8 | Console | 8.1 Operators · 8.2 core screens · 8.3 generated screens |
| 9 | Running safely | 9.1 limits per Project · 9.2 process groups · 9.3 tagging · 9.4 row-level security |
| 10 | Portability | 10.1 a key per Project · 10.2 export and import · 10.3 cells · 10.4 sale readiness · 10.5 deleting a user |
| 11 | Packaging | 11.1 move to the repository layout · 11.2 split `seo` into platform and OpenMarko's backend · 11.3 public packages and starter |

The order they're built in is under [Build order](#build-order), after the capabilities.

---

## 1. Module foundation

What makes "add things without rework" true. Built first, because every later table and module uses it.

### 1.1 Table helper
- One kernel helper defines every Project-owned table. It adds the UUIDv7 id, `project_id`, `organization_id` (when the table belongs to an Organization), `created_at` and `updated_at`, indexes that start with `project_id`, and registers the table for export (10.2) and row-level security (9.4).
- **Every table a Project owns carries `project_id`**, not only Project-level tables. Existing tables get it in one migration, backfilled with Project `openmarko`.
- A module's own migration then lists only its own columns. The Project rules can't be forgotten.
- Done when: every existing module table is defined through the helper, and a test fails if a table in a module schema is missing `project_id`.

### 1.2 Module manifest
- `defineModule` grows into a manifest. Each module declares, in one place: its settings (a Zod schema), permissions, Entitlement keys, API key scopes, jobs, events, provider capabilities, chat tools, and outgoing webhook events.
- Everything that lists modules reads the manifests: the API key scopes (2.1), the Roles catalog (3.3), Plan Entitlements (5.1), the console's generated screens (8.3), webhooks (2.4), chat tools (7.1) and per-Project API docs (2.6). Adding a module changes none of those by hand.

### 1.3 Settings from manifests
- The settings module stores one JSON record per Project per module (and per Organization where the manifest allows it), checked against the manifest's schema.
- Adding or changing a setting needs no migration.

### 1.4 Two-Project tests
- The test kit sets up two Projects that share an email address and an Organization name. Every module's tests run against both and check nothing crosses between them.
- Catches data leaks automatically, for every module, including ones added later.

---

## 2. Projects and API access

### 2.1 Projects and API keys
- `platform.projects`: id, slug, name, status, `cell`, enabled modules, allowed origins, quotas, created_at. Existing data becomes Project `openmarko`.
- `platform.project_keys`: id, project_id, name, kind (`publishable` | `secret`), hash of the key, the first characters shown in the console, scopes, expires_at, created_by (the Operator), last_used_at, revoked_at.

**Secret keys (Project API secrets).** Operators issue them for a Project, and the Project's servers use them to call the platform as that Project.
- Issued by an Operator in the console (8.2), or by the admin API until the console exists. The full key is shown once; only its hash is stored (SHA-256 is enough for long random keys).
- Prefixed `sk_proj_` (secret) and `pk_proj_` (publishable), so a leaked key is easy to spot and secret scanners can find it.
- Sent as `Authorization: Bearer sk_proj_…`. The key identifies the Project; no other header is needed.
- To act inside one Organization, the call names it (`/organizations/:orgId/…`). The platform checks that Organization belongs to the key's Project.
- **Scopes are `resource:action`** and come from the module manifests (1.2): each module declares its resources and actions (for example `messages:send`, `ai:use`, `integrations:call`), plus the platform's `project:settings`, `users:read`, `users:write`, `organizations:read`, `organizations:write`. A key with no scopes can do nothing.
- A key acts as the Project, never as one of its users. Sessions act as users.
- A Project can hold many keys at once, so a key is rotated by issuing a new one, deploying it, then revoking the old one. Keys can expire.
- Each call updates last used and counts toward that key's rate limit (9.1). Key creation and revocation are written to Activity.

**Publishable keys** may sit in a browser. They only identify the Project and reach routes a signed-in user or the chat widget may call.

- Done when: an Operator can issue and revoke a Project's keys, a secret key reaches only what its scopes allow and only its own Project, and keys are only ever stored hashed.

### 2.2 Resolve the Project on every request
- An Elysia plugin finds the Project from its domain (2.3), the secret key, or the publishable key header; loads it (cached briefly); and puts `project` and, for a key, its scopes on the request.
- CORS answers with that Project's allowed origins.
- A route from a module the Project hasn't enabled answers 404. `ENABLED_MODULES` remains the process's ceiling.
- Every job and outbox event carries `projectId`.
- Done when: two Projects with different modules and origins are served by one process, and neither can reach the other's routes.

### 2.3 Project domains
- **Every Project has its own API domain from day one** (`api.openmarko.com`, pointed at the platform). Sign-in redirects, Stripe and provider webhooks, cookies and email links all use it, never the platform's own domain. Moving or selling a Project then changes where the domain points, and nothing else breaks.
- `platform.project_domains`: domain, kind (api, app), verified_at. TLS certificates issued automatically.
- Deployed with Kamal 2. kamal-proxy issues Let's Encrypt certificates for the hosts listed in `deploy.yml` (automatic certificates assume one server per host). For Partner whitelabel domains added by customers, kamal-proxy has on-demand TLS (`--tls-on-demand-url`: it asks a platform endpoint whether a domain is known before issuing a certificate).
- Partner whitelabel domains use that on-demand TLS: the platform's check endpoint answers 200 only for verified Partner domains. If Kamal's config can't set it, Cloudflare for SaaS goes in front instead. No redeploy per Partner either way.
- **To confirm:** whether Kamal's `deploy.yml` can set on-demand TLS, or it needs a proxy boot option.

### 2.4 Outgoing webhooks
- A Project can register endpoints and choose events (user signed up, subscription changed, run finished…). The events each module can send come from its manifest.
- Sent from the outbox in the [Standard Webhooks](https://www.standardwebhooks.com/) format (`webhook-id`, `webhook-timestamp`, `webhook-signature`), so receivers verify with off-the-shelf libraries. Retried with backoff, with a delivery log in the console. The custom CMS site (ADR 0016) moves to the same format.
- The same signing covers the platform calling a Project's tools (7.1).
- How every Project backend follows what happens, and what outside developers would need first.

### 2.5 Project settings API
- A Project can change its own **Stripe** keys and webhook secret and its **sign-in** settings (methods, Google and other provider clients) without an Operator.
- `/api/v1/project/settings/stripe` and `/api/v1/project/settings/sign-in`, called with a secret key that has the `project:settings` scope. The Project's own server (or an admin screen in its frontend, through that server) makes the call; a secret key never reaches a browser.
- Secrets are write-only: reads return the last four characters and when it was changed.
- A change to sign-in settings evicts that Project's cached Better Auth instance. A change to Stripe keys is checked against Stripe before it's saved.
- Every change is written to Activity with the key that made it. Operators can make the same changes in the console.

### 2.6 API docs and versioning
- Major version in the URL (`/api/v1`). Within v1 changes only add (new fields, new routes). A breaking change is v2, with at least 6 months of overlap and a `Deprecation` header on the old routes. `@platform/client` versions with it.
- An OpenAPI document per Project showing only its enabled modules and the scopes each route needs. Generated from the routes and manifests.

### 2.7 Templates and admin API
- **`project.json` owns what the Project's code depends on**: required modules, feature catalog, its own Entitlement keys, tools, webhook events it subscribes to, extra Role permissions. Applied on every deploy; read-only in the console. It also holds **starter Plans**, used only to seed a new Project (or a staging copy); after that the console owns them.
- **The console owns the running setup**: Plans and prices, limits, domains, keys, Connections, sign-in, Operators.
- **A Project template** is `project.json` plus a snapshot of the console-owned defaults, without data: modules, settings, Plans, Roles, sign-in methods, widget settings, webhook events. A new Project is created from a template (or by copying another Project's setup).
- `/api/v1/admin/projects`: create from a template, edit, archive; keys; domains; modules; origins; quotas; Connections.
- `bun scripts/new-project.ts <slug> --from <template>` for use before the console exists. Prints the keys once.
- Protected by the admin token until Operators exist (8.1), then by Operator sessions; the token stays for scripts.

---

## 3. Users and auth

### 3.1 Confirm the scoped Better Auth adapter

**To confirm** before 3.2 is built (ADR 0017 depends on it). This is the first thing done when building starts, because it is the one result that could change the design.
1. Every database call Better Auth makes, including the organization plugin, invitations, verification tokens and rate limiting, goes through the database adapter.
2. Whether a `createAdapterFactory` adapter can delegate to Better Auth's Drizzle adapter, or must implement each method (create, findOne, findMany, update, updateMany, delete, deleteMany, count, consumeOne, incrementOne, transactions) itself.
3. Better Auth's migration doesn't put the global unique constraint on email back after we replace it.
4. The same email in two Projects works through every path: sign-up, sign-in, Google callback, password reset, email verification, invitations, switching Organization, sign-out.
5. One instance per Project: memory per instance, and how many fit in a process before eviction is needed.
6. Cookies and base URL per Project domain: a cookie set for one Project's domain is never accepted by another's.
7. If secondary storage (Redis) is used later, its keys include the Project.

If 1 or 4 fails, the identity module writes its own auth core instead (ADR 0017), and 3.2 changes shape.

### 3.2 Users per Project
- `project_id` on `auth.user`, `account`, `session`, `verification`, `organization`, `member`, `invitation`; unique `(project_id, email)` and `(project_id, provider_id, account_id)`.
- A Better Auth instance per Project, built on first use, cached, evicted when idle; each with the scoped adapter, its sign-in methods, its Google client from Connections, and its own domain as base URL.
- Sign-in methods per Project (email and password, Google, magic link…) are Project settings.
- The Better Auth version is pinned. The 3.1 tests become the upgrade gate.
- Auth emails (verification, password reset) use the email stub until messaging (6.1) is live.

### 3.4 Signed session tokens for Project backends
- A Project backend must know who is signed in without calling the platform on every request. The platform issues short-lived signed tokens for a session; `@platform/sdk` checks them locally against the platform's public keys (JWKS) and the Project they were issued for.
- Found (2026-11-06): Better Auth's JWT plugin issues tokens at `/api/auth/token`, publishes keys at `/api/auth/jwks`, allows custom claims (`definePayload`, so `projectId` can be added) and a 15-minute default lifetime; `jose` verifies locally against the JWKS. Its `jwks` table has no tenant column and the plugin reads it unfiltered, so without scoping every Project would sign with the newest key and publish every Project's keys.
- So: the `jwks` table gets `project_id` and goes through the Project-scoped adapter like every other auth table; `issuer` and `audience` are set to the Project's domain; `@platform/sdk` checks `iss`, `aud` and `projectId`.
- **To confirm:** the JWT plugin reads and writes `jwks` only through the adapter (part of check 1 in 3.1).

### 3.3 Organizations, Members and Roles per Project
- An Organization belongs to one Project; the caller guard checks it matches the request's Project.
- The Roles catalog a Project offers is built from the manifests of the modules it enables.
- **To confirm:** Better Auth's access control accepts a permission statement per instance.

---

## 4. Connections and providers

### 4.1 Project-level Connections
- `integrations.connections` can target a Project (`target_type = 'project'`). Lookup: Organization → Project → platform.
- Stripe keys, Google sign-in client, email provider, default LLM and webhook secrets move from the environment into Project Connections. The environment keeps the database URL, master keys and the admin token.
- Done when: `config.ts` no longer reads Stripe or Google values, and the `openmarko` Project behaves as before.

### 4.2 Capability APIs for providers
- Provider capabilities (DataForSEO's SERP, Labs, Backlinks, AI Optimization and On-Page; Google Business Profile; site writes through the CMS contract; LLMs; email) are callable by any Project with the `integrations:call` scope, metered per Project and Organization.
- Adding a provider stays as today: a catalog entry and an adapter (ADR 0002, 0013, 0016). Its connection form is generated from the catalog's fields.

---

## 5. Billing

### 5.1 Plans per Project
- `project_id` on Plans; Entitlement keys come from the manifests of the modules a Project enables. Plans stay data (ADR 0012).
- **Each Project's Plans are its own**, built by Operators in the console. The Entitlement keys a Plan can set come from the platform modules the Project enables (for example `ai.messages`, `knowledge.storage_mb`, `assistants`) and from the Project's `project.json` (for example OpenMarko's `rankings.keywords`). The console refuses a key the Project doesn't have. Nothing is inherited between Projects.
- **A Project's limits cap its Plans.** The platform's "plan" for a Project is its limits (enabled modules, quotas, rate limits, cell), with no billing between the platform and the owner's Projects. A Plan can't grant more than the Project's limits (OpenChat can't sell more AI messages than its quota). Charging Projects waits for outside developers and would reuse the same billing engine.
- **No "no Plan". Every Project's template has a default Plan that new Organizations get, so limits and features follow one rule and nothing is unlimited by accident.

### 5.2 Stripe per Project, with Stripe's hosted pages
- Stripe client from the Project's Connection; webhooks arrive on the Project's own domain (`api.<project domain>/webhooks/stripe`), checked with that Project's secret.
- Checkout and plan changes through **Stripe Checkout and the Customer Portal**, so no Project builds billing screens.
- Stripe Connect (an Organization charging its own customers) stays out of scope until a Project needs it.

### 5.3 Profit and loss per Project
- Revenue from the Project's Stripe account, provider and LLM costs from `usage_events`, and an estimated share of hosting. Shown in the console's Usage screen. What a buyer will ask for.

---

## 6. Messaging

### 6.1 Messaging module
- Email moves out of integrations into `messaging`: `send` goes through the outbox and the worker.
- Adapters: SES (SESv2), SendGrid, SMTP, Resend, Postmark; stubs kept (ADR 0013).
- Templates and sender domains per Project, suppression list, bounce and complaint webhooks.
- Each Project sends from its own domain. A shared platform sender is allowed only while a Project is new, and the sale checklist (10.4) flags it.

---

## 7. AI

Absorbs the old phase 3 (assistant platform).

### 7.1 AI module
- Model access through the Vercel AI SDK (v7: Anthropic, OpenAI, Google, OpenRouter), replacing the hand-written calls in `modules/integrations/src/adapters/llm.ts`. Streaming works under Bun and Elysia (Elysia documents it). Two rules: raise Bun's `idleTimeout` on `api-ai` (it closes a connection after 10 s with no bytes, which cuts off slow tool calls), and pass `abortSignal: request.signal` to `streamText`, since Elysia doesn't cancel the stream when the client disconnects.
- Conversations and messages; a streaming chat endpoint on `api-ai` (9.2).
- Tool registry: platform modules declare tools in their manifest; a Project backend declares its tools in `project.json` as HTTP endpoints with JSON schemas, which the platform calls with Standard Webhooks signing. Tools run with the caller's permissions. Outside MCP servers are a further tool source.
- **Models are named explicitly.** Plans and assistants list the models they allow by vendor, name and version (for example `anthropic/claude-sonnet-5-5`), shown as such to Organizations.
- **Custom model names** sit beside them: a Project defines a name of its own (for example `chat-pro`) backed by a configured model and its settings (vendor, model, version, temperature, token limits). Plans can grant custom names, so the model behind one can be upgraded without touching Plans or assistants; Organizations see the custom name and the model currently behind it.
- When a vendor retires a model, Operators map it to a replacement in the console and Organizations using it are told.
- Keys from Connections (Organization → Project → platform).

### 7.2 Knowledge
- pgvector in the same database; knowledge bases, sources, chunks with an HNSW index and a text index for hybrid search.
- Ingestion jobs in the worker: fetch, chunk, embed.
- Each knowledge base records the embedding model and dimensions it was built with; changing the model re-embeds into a new index, never mixes. Default: a model of at most 2,000 dimensions from the Project's LLM Connection, chosen when 7.2 is built.
- Retrieval as a chat tool. A `VectorStore` interface so a dedicated store can replace pgvector later.
- Found (2026-11-06): Neon Postgres 17 has pgvector 0.8.0 with HNSW. `vector` indexes up to 2,000 dimensions; larger embeddings use `halfvec` (up to 4,000). Build indexes after loading data.

### 7.3 Chat widget
- A web component built with Preact inside a shadow DOM, so the host page's CSS can't break it and it can't break the host. Under 50 KB gzipped. Served from R2 behind Cloudflare's CDN at versioned addresses (`/widget/v1.js`, plus pinned exact versions). Assistant settings load at runtime, so a settings change never needs a new snippet. Code in `platform/packages/chat-widget`.
- Authenticates with a publishable key plus either a signed-in session or a signed anonymous visitor token.
- Per-Project widget settings (from the manifest): allowed origins, look, knowledge bases, which tools anonymous visitors may use (read-only only).
- Abuse protection: an assistant runs only on its allowed origins; anonymous visitors pass Cloudflare Turnstile before chatting; limits per IP and per visitor under the Project's chat caps; an Organization's monthly message allowance is a hard stop, with an email at 80%.

---

## 8. Console

A small web app for Operators to manage Projects. Not the product UI of any Project. Stack: `platform/apps/web`, React with Vite, Tailwind and React Router (as `ui-mock/`), calling the API through the typed Eden client.

### 8.1 Operators and their permissions
- **Operator** (see [GLOSSARY.md](../../../GLOSSARY.md)): a person who manages Projects. Operators are users of a reserved Project, `console`, so the console signs in through the same auth as any Project.
- Operators must use two-step sign-in (authenticator app, Better Auth's two-factor plugin); the console can optionally be limited to known IP addresses.
- Platform role per Operator: Owner (everything, including other Operators), Admin (all Projects), Viewer (read only).
- Per-Project grants (`platform.project_members`: operator, project, role Owner | Admin | Viewer), so a Project can have its own managers. This is the start of outside developers.

### 8.2 Core screens (hand-built)

| Screen | What it does |
|---|---|
| Projects | List, search, create from a template, archive. Status, cell, users, usage at a glance. |
| Project → Overview | Name, slug, domains and their verification, allowed origins, status, cell. |
| Project → Keys | Publishable and secret keys: create, scopes, last used, revoke. Shown once on create. |
| Project → Connections | Stripe, email provider, LLM, webhook secrets. Forms generated from provider fields. Secrets write-only. |
| Project → Plans | Plans and Entitlements; assign a Plan with no payment; overrides for one Organization. Replaces today's admin-token billing routes. |
| Project → Users | Operators see the Project's users and their Organizations: search, view, disable. Every view and change by an Operator is written to Activity. |
| Project → Usage | Requests, jobs, emails, LLM tokens and cost; profit and loss (5.3). |
| Project → Sale readiness | The checklist from 10.4, and export (10.2). |
| Operators | Platform Owners only: invite, change role, remove. |

### 8.3 Generated screens
Built from the module manifests, so a new module needs no new screen code:
- Project → Modules (turn on and off), Project → Settings (one form per module, from its Zod schema), Project → Sign-in, Project → Webhooks (endpoints, events, delivery log), Project → Limits, Project → Managers.

---

## 9. Running safely

### 9.1 Limits per Project
- Rate limits per Project and per key, at the API. Defaults, each changeable in the console: 600 requests a minute per secret key; 120 a minute per IP for publishable keys; 20 chat streams at once per Project; 5 jobs at once per Project per queue.
- Concurrency caps per Project in the worker: pg-boss (≥ 12.38.1) has this built in. Jobs are sent with `group: { id: projectId, tier }` and workers set `groupConcurrency` (a limit per group across all workers, enforced in the database), optionally by tier. Bump pg-boss from ^12.38.0.
- One wrapper every provider call goes through: timeout, retries with backoff, circuit breaker per provider and Project.
- Database statement timeouts, and early 503s when a process is saturated.

### 9.2 Process groups
- Start with three, all from the same image: `api`, `api-ai` (chat streaming) and `worker`. Split email or AI workers out only when one actually needs it.
- kamal-proxy routes by path (`path_prefix`): `api-ai` is mounted at `/api/v1/ai` on each Project's API domain, inheriting the root path's TLS settings. For chat streams, raise `response_timeout` (default 30 s) and turn off response buffering on `api-ai`.
- **To confirm:** `api` and `api-ai` as two Kamal roles (or apps) sharing a host with different path prefixes.

### 9.3 Tagging
- Logs, errors and metrics carry `projectId`, so one Project's problems can be seen apart from the others.

### 9.4 Row-level security
- Postgres policies on every platform table from the table helper (1.1): a row is visible only when its `project_id` matches the one set for the transaction. A safety net under the application's own filters.
- **To confirm:** row-level security with pooled connections, and with Better Auth's queries.

---

## 10. Portability

What makes moving or selling a Project an operation, not a project.

### 10.1 An encryption key per Project
- Each Project gets its own key, wrapped by the platform's master key. Its Connections' data keys are wrapped by the Project key (extends ADR 0010).
- Moving or selling a Project hands over its key, re-wrapped for the new owner, never the platform's master key.

### 10.2 Export and import
- One command exports a Project's platform data: every table registered by the table helper, filtered by `project_id`, plus its auth rows, its re-wrapped key and its settings. One command imports it into an empty database running the same code. The Project's own database already belongs to it and goes as it is.
- **Runs in the test suite**: export a seeded Project, import it into an empty database, compare. So it can't quietly break as modules are added.
- Doubles as a per-Project backup; Neon's point-in-time restore covers the whole database only.

### 10.3 Cells
- Every Project has `cell = 'cell-1'`. A second cell is a database plus process groups; moving a Project there is export, import, and pointing its domain at the new cell.

### 10.4 Sale readiness
A checklist per Project, shown in the console:
- Own domain for API and app (2.3).
- Own Stripe account (5.2), Google sign-in client, email sending domain (6.1), and LLM key (not the platform default).
- Own encryption key (10.1); export passes (10.2).
- Code: everything lives in `projects/<slug>/`, and it imports only the platform's public packages (the lint rule passes).
- Profit and loss available (5.3).
- Handles `user.deleted` (10.5).

A buyer receives `projects/<slug>/`, its database, the platform code and the platform export, and runs the platform as a single-Project deployment.

### 10.5 Deleting a user
- Deleting a user removes their auth rows, sessions and memberships. Data they created in an Organization stays with the Organization; personal fields in Activity are anonymised.
- The platform sends `user.deleted`; each Project backend deletes its own copy. The sale checklist checks the Project handles it.

---

## 11. Packaging

### 11.1 Move to the repository layout
- `apps/`, `modules/`, `packages/` move under `platform/`; packages are renamed from `@openmarko/*` to `@platform/*`. Today's composition package (`packages/platform`) becomes `@platform/server`, so nothing is called `@platform/platform`.
- `ui-mock/` moves to `projects/openmarko/apps/web`, `site/` to `projects/openmarko/apps/site`.
- The import-boundary lint rule, `tooling/`, `docker-compose.dev.yml` and the `bun dev [slug]` runner are added.
- Docs split into `platform/docs` and `projects/openmarko/docs`.

### 11.2 Split `seo`
- Provider calls and their typed results stay in the platform (most already sit in `integrations`); OpenMarko's workflows move to `projects/openmarko/apps/api` with their tables in OpenMarko's own database, calling the platform through `@platform/client`.

### 11.3 Public packages and starter
- `@platform/client` (typed API client), `@platform/sdk` (session and webhook checks, config, logger), `@platform/react` (sign-in, billing and chat components, plus the chat admin screens: assistant editor, documents, skills, prompts, tools, inbox), `@platform/chat-widget`, each versioned.
- A Project starter (`projects/_starter/`): api, web, `project.json`, Dockerfile and `.env.example`, with sign-in, Stripe's hosted billing pages and the chat widget wired up. `new-project` copies it.

---

## The second Project: OpenChat

An embeddable AI chat any app can add. Each Organization manages its own assistants, knowledge-base documents, skills, prompts and tools. Slug `openchat` (`projects/openchat/`).

**Platform versus Project.** The chat engine is platform (`ai`, `knowledge`, the widget), and so are its admin screens (components in `@platform/react`), so OpenMarko and later apps use the same engine and screens. The OpenChat Project is its dashboard layout (assembling those screens, plus the embed snippet), its Plans and its marketing site. It tests "Project code stays thin"; OpenMarko's SEO backend tests "Project has its own backend".

| Concept | Decision |
|---|---|
| **Assistant** | What an Organization configures and embeds: model, instructions, knowledge bases, skills, prompts, tools and widget settings. Several per Organization; how many is an Entitlement. |
| **Skill** | The open Agent Skills format: a folder with a `SKILL.md` (name and description say when to use it) plus optional files. The model loads one only when relevant, through a `load_skill` tool, so it works with any model. |
| **Prompt** | Saved, versioned prompt templates with variables, used as assistant instructions or as quick actions in the widget. A change can be rolled back. |
| **Tools** | Three kinds, turned on per assistant: platform capabilities the Project allows; HTTP tools the Organization defines (URL, JSON schema, auth encrypted in Connections); remote MCP servers it connects. Tools that change something ask the user to confirm in the widget. Anonymous visitors get read-only tools only. |
| **Documents** | At launch: PDF, DOCX, Markdown, text, HTML, a single web page by URL. Later: sitemap crawl and scheduled re-sync. Parsed in the worker with libraries; a paid parser for scanned PDFs can come later, metered. Size and count limits are Entitlements. |
| **Who's chatting** | Anonymous by default. The host app can identify its signed-in user with a short token its server signs with a secret per assistant; the conversation is then tied to that user and can use user-specific tools. |
| **Conversations** | An inbox in the dashboard: transcripts, search, ratings, and "answer not found" flags pointing at knowledge-base gaps. Retention set by the Plan, 90 days by default. No hand-off to a human agent in the first version. |
| **Selling** | Plans with included monthly messages, assistants, storage and document counts; Stripe Checkout; extra messages billed through Stripe meters fed from `usage_events`. The platform's model key is used (no Organization keys in the first version); its cost shows in the Project's profit and loss. |
| **Partners** | Off for OpenChat at first; can be turned on later without code changes. |

## Operations

- **Environments:** local (Docker Postgres and Mailpit), staging (a Neon branch of production, on its own small VPS), production (one VPS running the platform and every Project, each in its own container). More servers come per cell, with Cloudflare or a load balancer in front once one host needs more than one server.
- **Deploy secrets:** Kamal's `.kamal/secrets` reads from a password manager (1Password or Bitwarden; Bitwarden if neither is in use). Never plain values in the repo. Only infrastructure secrets live there; Projects' provider keys are encrypted in Connections.
- **CI:** GitHub Actions. Every pull request runs `bun run check`, the import-boundary lint and the two-Project tests. Images are built only for what changed (the platform, or one `projects/<slug>`). Merging to `main` deploys to staging; production is a manual promote of the same image.
- **File storage:** Cloudflare R2 behind an S3-style interface, for knowledge-base files, logos, exports and backups.
- **Errors, logs and uptime:** Sentry for errors, structured logs and uptime checks. Every event carries `projectId` and the process group.
- **Backups:** Neon point-in-time restore for the whole database (at least 7 days); a nightly export per Project (10.2) to R2, kept 30 days, so one Project can be restored without rolling back the others; a monthly restore test in CI against a Neon branch.
- **Docs:** reorganised into `platform/docs` and `projects/openmarko/docs`, with the glossary split, in the same change as the folder move (11.1).

## Build order

Milestones, each made of pieces from the capabilities above. Each piece ends with a review and its docs updated, as in [roadmap.md](roadmap.md).

| Milestone | Pieces | Done when |
|---|---|---|
| **M0. Prove the auth approach** | 3.1, and the check in 3.4 | The checks in 3.1 and the token check in 3.4 pass, or the switch to our own auth core is decided |
| **M1. OpenMarko runs as a Project** | 11.1 (layout first, so new code lands in place), 1.1 → 1.2 → 1.3 → 1.4, 2.1 → 2.2 → 2.3, 4.1, 3.2 → 3.3 → 3.4, 5.1 → 5.2, 6.1, 2.7, 8.1 → 8.2 | OpenMarko works as before, on its own domain, with its settings in Connections and Operators managing it in the console |
| **M2. AI platform** | 7.1 → 7.2 → 7.3, 9.1 (public-facing limits), 10.1 → 10.2 | Assistants with knowledge, skills, prompts and tools work through the widget under per-Project limits; export and import pass |
| **M3. The OpenChat app launches** | 11.3, 2.4, 2.5, 8.3, 4.2, the OpenChat Project | OpenChat is built from the starter and a template with no platform code changes, and sells Plans through Stripe |
| **M4. Safe to grow** | 9.2 → 9.3, 5.3, 10.4 | One Project's load or failure can't take another down; sale readiness shows for every Project |
| **M5. Packaged** | 11.2, 2.6, 9.4, 10.3 when a Project needs its own cell | OpenMarko's SEO workflows run in `projects/openmarko/apps/api` on its own database |

Why this order:
- **M0 first**: it's independent of everything else and is the only result that could change the design.
- **The layout move (11.1) opens M1**: moving folders before new code is written is a rename; after, it's a migration.
- **The module foundation (1.x) before anything that adds tables**, so no table is written twice.
- **Domains (2.3) in M1**, because every sign-in redirect and webhook address set later depends on them.
- **The AI platform (M2) comes before the second app**, because OpenChat is AI-first and its widget faces the public internet, so it needs the limits in 9.1 too.
- **The second app (M3) is the real test** of "rows, not code". Anything OpenMarko-specific still in the platform shows up there.
- **Export (10.2) by M2**, so it's tested before the second Project exists, not retrofitted.

## Not now

- A generic data store that lets an app keep records without its own tables (like Firebase). Tempting for very small apps, but a product in itself.
- Self-serve sign-up and billing for outside developers, and abuse controls for them.
- Stripe Connect.
- Running developers' own code.

## To confirm (all, in one place)

| # | What | Blocks |
|---|---|---|
| 1 | Better Auth reaches the database only through its adapter | 3.2 |
| 2 | A custom adapter can delegate to the Drizzle adapter, or must implement every method | 3.2 |
| 3 | Better Auth's migration leaves our per-Project unique constraints alone | 3.2 |
| 4 | The same email in two Projects works through every sign-in path | 3.2 |
| 5 | Memory per Better Auth instance; when eviction is needed | 3.2 |
| 6 | Cookies per Project domain are never accepted by another Project | 3.2 |
| 7 | Better Auth access control accepts a permission statement per instance | 3.3 |
| 8 | Kamal: on-demand TLS for Partner domains settable from `deploy.yml` or only as a proxy boot option | 2.3 |
| 9 | ~~pg-boss per-Project caps~~ found: `groupConcurrency` (≥ 12.38.1) | 9.1 |
| 10 | Kamal: `api` and `api-ai` sharing a host by path prefix (roles or apps) | 9.2 |
| 11 | ~~AI SDK streaming under Bun and Elysia~~ found: works, with the idle-timeout and abort rules in 7.1 | 7.1 |
| 12 | ~~pgvector on Neon~~ found: 0.8.0 with HNSW | 7.2 |
| 13 | Row-level security with pooled connections and Better Auth's queries | 9.4 |
| 14 | Better Auth's JWT plugin reads and writes `jwks` only through the Project-scoped adapter | 3.4 |

## Decided

- 2026-11-06: **Operator** is the word for people who manage Projects (added to the glossary).
- 2026-11-06: Operators can see a Project's users, with every view and change recorded in Activity.
- 2026-11-06: the console holds every platform and Project setting. A Project's own frontend has only Organization and Partner screens, except that a Project may change its own Stripe and sign-in keys through the Project settings API (2.5).
- 2026-11-06: the backend platform is named **mkitup**. OpenMarko is one Project on it. In code the platform is unbranded: `@platform/*`.
- 2026-11-06: one repository for now: the platform and every Project (`projects/<slug>/`) together.
- 2026-11-06: provider connections (DataForSEO, Google Business Profile and the rest) are platform capabilities. A Project's own logic lives in the Project's own code (`projects/<slug>/`).
- 2026-11-06: Operators issue each Project's API secrets (scoped secret keys); the Project's servers use them to call the platform.
- 2026-11-06: a secret key never acts as one of the Project's users. Keys act as the Project; sessions act as users.
- 2026-11-06: repository layout: `platform/` and `projects/<slug>/`, each with `apps/` (`api`, `worker`, `web`, `site`) and `packages/`. The console is `platform/apps/web`. A Project is its own service with its own Docker image and database, reaches the platform only over HTTP and through four public packages, enforced by a lint rule. Replaces the earlier default of in-process Project modules.
- 2026-11-06: hosting is a VPS deployed with Kamal 2 (chosen over haloy, which routes by host only and can't add certificates without a redeploy, and over Uncloud, which is pre-1.0).
- 2026-11-06: module ownership (see "Module ownership"): Partners, Clients, consent and whitelabel are platform; Locations and Websites are OpenMarko's; automation becomes generic workflows over any tool; feature switches are platform, with a feature catalog per Project.
- 2026-11-06: databases: one Neon project (`openmarko`, id `wandering-paper-07929606`) holds the `platform` database and one database per Project. Selling a Project means dumping its database plus the platform export.
- 2026-11-06 (grilling round 1, owner took the recommended answers): starter backend on the platform's stack; React and Vite frontends with a prerendered marketing site; Project jobs on their own pg-boss; generic automation defined by developers now, a visual builder later; Project tools as signed HTTP endpoints in `project.json`; Connections point at Project resources by type and id; `partners` is its own opt-in platform module; feature catalogs in `project.json`; every Project has a default Plan (no "no Plan"); URL major versions with additive changes; Standard Webhooks; `resource:action` scopes; local, staging and production environments; GitHub Actions CI; Cloudflare R2; Sentry and a hosted log service; user deletion with `user.deleted`; default limits; docs move with the code.
- 2026-11-06 (grilling round 2): deploy with Kamal 2; backups as in Operations; Sentry for errors, logs and uptime; automation engine on pg-boss; workflows as JSON from a typed builder; `project.json` owns code-dependent setup, the console owns running setup; Operators use two-step sign-in; embedding model recorded per knowledge base.
- 2026-11-06: **the second Project is an AI chat widget product**: an embeddable chat any app can add, where each Organization manages its own knowledge-base documents, skills, prompts and tools.
- 2026-11-06 (grilling round 3): Partner domains by kamal-proxy on-demand TLS (Cloudflare for SaaS as fallback); deploy secrets from a password manager through `.kamal/secrets`; one production VPS and one staging VPS to start; the `chat` Project as described in "The second Project"; build order M0 auth, M1 OpenMarko, M2 AI platform, M3 `chat`, M4 safe to grow, M5 packaged.
- 2026-11-06 (grilling round 4): Plans are per Project, built in the console from platform and Project Entitlement keys, with starter Plans seeded from `project.json`; the platform's plan for a Project is its limits, which cap its Plans, with no billing between platform and Projects for now; widget is a Preact web component on R2 and Cloudflare; abuse protection by origins, Turnstile and limits; models named explicitly (vendor, name, version) beside custom names backed by configured models; chat admin screens are `@platform/react` components.
- 2026-11-06: the second Project is named **OpenChat** (slug `openchat`).
- 2026-11-06: review applied. Goals in order: launch speed, selling apps one at a time, no rework when adding things, outside developers possible later. Added: `project_id` on every Project-owned table through one table helper, module manifests driving scopes, settings, Roles, Entitlements and console screens, Project templates, Project domains from day one, outgoing webhooks, an encryption key per Project, export and import tested in the suite, profit and loss and sale readiness per Project, two-Project tests. Plan grouped by capability with milestones; the Better Auth check moved first.
