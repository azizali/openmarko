# App boilerplate

A fork-and-go starting point for a SaaS product: sign-in, Organizations and Roles, feature switches, settings, Plans and billing, email, integrations with encrypted credentials, AI models and assistants, knowledge bases, a chat widget, automation with Tasks and schedules, and Partners with whitelabel. Each optional part is a switch in one file.

- **API and worker**: Bun, Elysia, Drizzle, Better Auth, pg-boss. Postgres (Docker locally, Neon in production). Deployed to a VPS with Kamal.
- **Web app** (`apps/web`) and **marketing site** (`apps/site`): React, Vite, Tailwind, deployed to Vercel.
- **One config file**, `app.config.ts`: the app's name, which modules are on, which features Organizations can switch.
- **One env file**, `.env`: database, secrets, and keys for services that turn themselves on when present.

## Quick start

You need [Bun](https://bun.sh) and Docker.

```sh
bun run setup
```

It asks for the app's name, which modules you want, your email and any AI keys, then starts the database, creates your admin account and opens the app. Every provider you don't give a key for runs as a stub, so nothing needs a vendor account. API docs: http://localhost:3000/openapi. Mail the app sends: http://localhost:8025.

## Deploy

You need a VPS, a Neon database, a GitHub repository, and `gh` and `vercel` signed in.

```sh
bun run deploy:setup
```

It asks where the app goes, checks that those places work, prepares the database, makes your production admin, sets GitHub's secrets, creates the Vercel projects and starts the first deploy. After that, a push to `main` deploys. Details: [docs/deploy.md](docs/deploy.md).

## Make it yours

1. `app.config.ts`: your feature switches, and anything else `bun run setup` didn't ask.
2. `.env`: keys for Google sign-in, Stripe and Turnstile as you need them. For production, `.env.production`, then `bun run deploy:setup` again.
3. Add your product as a module under `modules/<name>/` (see [docs/modules.md](docs/modules.md)) and its pages under `apps/web/src/pages/`.
4. Replace the site's copy in `apps/site/src/data/site.ts`.

## Commands

| Command | What it does |
|---|---|
| `bun run setup` | From a fresh fork to the app running here. Safe to rerun. |
| `bun run deploy:setup` | From a working fork to production. Safe to rerun. |
| `bun run admin:create <email>` | Make an app admin in whichever database `DATABASE_URL` names |
| `bun dev [api\|worker\|web\|site]` | Start everything, or only the named processes |
| `bun run check` | Lint, format check, type check, tests. Green before every merge. |
| `bun test` | The API's tests, each file on its own throwaway database |
| `bun run db:generate` | A new migration from the modules' schemas, after a schema change |
| `bun run db:migrate` | Apply migrations (what the deploy runs) |
| `bun run db:seed` | Development data (idempotent) |
| `bun run db:reset` | Drop, recreate, migrate and seed the local database |

## Read next

- [docs/README.md](docs/README.md): how the docs are organised.
- [docs/architecture.md](docs/architecture.md): the shape of the code and a request's path.
- [docs/configuration.md](docs/configuration.md): every switch in `app.config.ts` and every variable in `.env`.
- [docs/modules.md](docs/modules.md): adding a module, a provider, a feature, a Task kind.
- [docs/GLOSSARY.md](docs/GLOSSARY.md): the words the code uses.
- [docs/decisions](docs/decisions/): why things are the way they are.
