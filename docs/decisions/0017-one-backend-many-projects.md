# 0017. One backend serves many Projects

- Status: Accepted
- Date: 2026-11-05
- Affects: platform/backend, platform/integrations, platform/access-roles, platform/organizations-partners
- Builds on: [0008](0008-modules-by-feature.md) (modular monolith), [0010](0010-envelope-encrypted-credentials.md) (encrypted credentials), [0014](0014-llms-are-integrations-with-a-platform-default.md) (platform default LLM)

## Context

The owner wants this backend to serve many of their own applications, not only OpenMarko, so a new application starts with auth, billing, email, AI and knowledge already working. Each application uses only some modules, and each needs its own provider settings: its own Google sign-in client, its own Stripe account, its own email sender.

Today the backend serves one product. Tenancy stops at the Organization, and application-level settings come from the environment (`STRIPE_SECRET_KEY`, `GOOGLE_CLIENT_*`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `ENABLED_MODULES`), so one deployment can only be one application.

The alternative, a separate backend per application, keeps applications apart but repeats the deploy, database and keys for every one. Most of the saved boilerplate comes from shared code either way. A shared runtime adds lower running costs and one place to operate, at the price of a larger blast radius, which [0018](0018-isolation-by-process-groups-and-cells.md) addresses.

## Decision

- The backend platform is named **mkitup**. OpenMarko is one Project on it. In code the platform is unbranded (`@platform/*`). The platform and every Project share one repository for now.
- **Project** is a new level above Organization: one application built on this backend (OpenMarko is one Project). It is a database row (`platform.projects`), never a deployment, so the same image can serve many small Projects or give one Project its own deployment.
- Each Project has **keys** (`platform.project_keys`): publishable keys a browser may hold, and scoped secret keys that Operators issue so the Project's servers can call the platform as that Project. A Project can hold several at once for rotation. Keys are stored hashed and shown once.
- Every request resolves its Project (publishable key header or host), which sets the allowed origins and which modules answer. `ENABLED_MODULES` stays as the process's ceiling; each Project turns on a subset.
- **Shared tables, keyed by Project.** Every Project's data lives in the same tables. Creating a Project inserts rows (the Project, its keys, its Connections) and never creates a table or a schema. This is how large multi-tenant services work: Auth0 separates customers logically in the application layer, and Okta scales by cells, each a full copy of the service holding some customers.
- An Organization belongs to one Project (`project_id` on `auth.organization`). The caller guard checks the Organization's Project matches the request's.
- **Every table a Project owns carries `project_id`**, set by one kernel table helper, with indexes that start with it. A Project's rows are then one filter away, for export, moving to another cell, row-level security and deletion.
- **Each Project has its own domain** for its API from the start. Sign-in redirects, webhooks, cookies and email links use it, so moving or selling a Project only changes where the domain points.
- **A Project can be moved or sold**: one command exports it (every registered table filtered by `project_id`, its auth rows, its settings, and its own encryption key re-wrapped for the new owner) and imports it into an empty database. The export runs in the test suite.
- **Modules declare themselves in a manifest** (settings schema, permissions, Entitlement keys, API key scopes, jobs, events, tools). API key scopes, the Roles catalog, Plan Entitlements, per-Project API docs and the console's module screens are built from the manifests, so adding a module edits none of them by hand. A new Project is created from a template (another Project's setup without its data).
- **Users are not shared between Projects.** `auth.user`, `account`, `session`, `verification`, `organization`, `member` and `invitation` each carry `project_id`. Email is unique per Project (`unique (project_id, email)`), and sign-in accounts per Project (`unique (project_id, provider_id, account_id)`). The same email in two Projects is two unrelated users.
- **Better Auth is scoped through its database adapter.** Better Auth has no multi-tenant support: it looks users up by email alone, and its tenant request ([#1248](https://github.com/better-auth/better-auth/issues/1248)) was closed as not planned in March 2026; the 1.7 docs and the 1.8 beta docs don't mention tenants. So each Project gets its own Better Auth instance, built in memory on first use and cached, with:
  - a database adapter (`createAdapterFactory`) bound to that Project, which adds `project_id = <Project>` to every read, update and delete, and sets it on every create, for every model. Better Auth's code never sees another Project's rows.
  - that Project's social sign-in clients (Google and others), origins and base URL, read from its Connections.
  The instances share one pool; they cost memory, not tables.
- We own the auth tables' unique constraints: a migration drops Better Auth's global unique on email and adds the per-Project ones.
- **Plans are per Project.** The billing engine is the platform's; each Project's Plans are console data built from the Entitlement keys of the platform modules it enables and of its own `project.json`, seeded from starter Plans in `project.json`. The platform's plan for a Project is its limits (modules, quotas, rate limits, cell), which cap what its Plans can grant. No billing between the platform and the owner's Projects until outside developers.
- Rejected: a Postgres schema per Project (one per tenant does not scale and needs a migration for every Project and every Better Auth upgrade); encoding the Project into the email address (the workaround suggested in #1248: it leaks into every email, provider profile and lookup).
- **Project settings move from the environment into Connections.** A Connection can target a Project (`targetType: 'project'`). Lookup order is Organization, then Project, then platform. Stripe, Google sign-in, the email provider, the LLM and webhook secrets become encrypted Connections. The environment keeps only infrastructure: database URL, master keys, admin token.
- A Project's own Stripe charges its Organizations; its webhooks arrive at `/webhooks/stripe/:projectId`, checked with that Project's secret. An Organization charging its own customers is Stripe Connect, a separate decision.
- **Platform modules** (identity, organizations, access, billing, integrations, messaging, ai, knowledge, automation) are shared, including connections to providers such as DataForSEO and Google Business Profile, offered as capability APIs. A Project's own logic (OpenMarko's SEO workflows) lives in `projects/<slug>/` with its own backend, frontend, Docker image and database. It reaches the platform only over HTTP (secret key, outgoing webhooks, signed session tokens) and in code only through the public packages `@platform/client`, `sdk`, `react` and `chat-widget`; a lint rule enforces it. The platform lives in `platform/`; both use `apps/` (`api`, `worker`, `web`, `site`) and `packages/`.
- Platform and Project settings are managed by Operators in the mkitup console. A Project may change its own Stripe and sign-in keys through a Project settings API, with a secret key scoped `project.settings`; changes are recorded in Activity.
- Only the owner creates Projects, by script (`scripts/new-project.ts`), not through a self-serve console. These choices are made now so outside developers stay possible later: hashed keys, quotas and a cell (0018) on every Project, Projects with a members list rather than one owner, admin routes apart from Project routes.

## Consequences

- One Better Auth instance per Project is cached in the process (evicted when unused). A Better Auth upgrade is one migration for all Projects.
- The scoped adapter is the risk. A Better Auth release that reaches the database another way, or adds a model the adapter doesn't know, could cross Projects. So: the Better Auth version is pinned; a spike proves the adapter before anything else is built on it; tests run every sign-in path (password, Google callback, password reset, email verification, invitations, Organization switch) with the same email in two Projects; upgrades pass that suite first. Postgres row-level security on the auth tables is the later backstop. If the spike fails, the identity module owns its own auth core instead (users, sessions, accounts and tokens with `project_id`, libraries for hashing and OAuth); the module boundary keeps that swap contained.
- `auth.organization` and the other auth tables gain columns through our migrations, a change to ADR 0015's rule that Drizzle never touches auth tables: Better Auth still creates them, we add `project_id` and the constraints.
- Opening the platform to outside developers is a later decision and a large one: developer accounts and a console, email and LLM abuse controls, row-level security, public SDKs and versioning, legal and support. Shared tables mean auth needs no redesign for it. Running developers' own code is out of scope.
- Unrelated Projects share a database until one is moved to its own cell. A Project with compliance or residency needs gets its own cell from the start.
- Existing OpenMarko data becomes Project `openmarko`; its env settings become that Project's Connections.
