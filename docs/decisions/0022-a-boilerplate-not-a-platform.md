# 0022. A boilerplate to fork, not a platform to host

- Status: Accepted
- Date: 2026-11-08
- Affects: everything
- Supersedes: the platform-era ADRs 0017, 0018, 0019 and 0021, and retires 0001 and 0016 (all since deleted)

## Context

The repository had grown into a hosted platform (mkitup): one backend serving many Projects as tenants in shared tables, API keys and per-Project domains, an Operator console, signed session tokens for Project backends, and a plan for process groups, cells and row-level security. It served two Projects for one owner.

That shape pays off with many Projects or outside developers. For one developer launching apps one at a time it costs an extra network hop for any app with a backend, no transaction across app and platform data, two deploys and two databases per app, a console to maintain, and a long isolation roadmap, none of which the goal (reuse sign-in, Organizations, billing, email, AI and integrations across apps) needs.

## Decision

- The repository is a **boilerplate**: fork it per app. One app, one database, one deploy of the API and worker, one web app, one site. No Project concept, no `project_id`, no API keys, no per-host resolution, no Operator console.
- What was reusable stays: the modules (identity, organizations, access, features, settings, integrations, messaging, billing, partners, ai, knowledge, automation), the kernel (config, outbox, crypto, module manifests, settings), the test kit, the deploy with Kamal and Vercel.
- **Optional modules are switches** in `app.config.ts`. Core modules reach them through hooks on the context (`billingOf`, `knowledgeOf`) with no-op defaults, so a fork with a module off still builds, boots and passes its tests. The web app gates a module's pages behind a build-time flag, so they drop from the bundle.
- **App admins** replace Operators: Better Auth's admin plugin marks users with the `admin` role; `ADMIN_EMAILS` makes the first ones. The Admin area lives in the web app.
- **The app's own services come from the environment** (Google sign-in, Stripe, Turnstile) because Better Auth and the billing routes need them at boot; provider accounts (email, models, Slack) stay encrypted Connections, now with an `app` target in place of `platform` and `project`.
- Fresh schema, fresh migrations. Nothing deployed under the platform model is carried over.
- Removed with the platform: OpenMarko's SEO module and mock, OpenChat, Locations and Websites, the DataForSEO and Google Business Profile adapters, the CMS contract, the public `client` and `sdk` packages.

## Consequences

- Fixes to shared code don't propagate to apps already forked. If that bites, the modules can be published as packages later; the module boundaries already allow it.
- Each app runs its own database and its own worker: more copies of small infrastructure, no shared blast radius.
- Selling or moving an app is moving its repository and its database, with nothing to untangle.
