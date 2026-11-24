# Configuration

`app.config.ts` (checked in; what the app is), `.env` (not checked in; where it runs and its secrets), and for production `deploy.config.json` (checked in; where it deploys) with `.env.production` (not checked in; production's secrets). `bun run setup` and `bun run deploy:setup` fill these in.

## app.config.ts

| Key | What it does |
|---|---|
| `name`, `slug` | Shown in the app, emails and API docs. A Partner's whitelabel brand replaces the name for its Clients. |
| `modules.billing` | Plans, Entitlements, metering, Stripe. Off: every feature allowed, nothing limited or metered. Platform admin → Plans & usage and Settings → Billing disappear. |
| `modules.partners` | Partners creating and managing Client Organizations and their whitelabel brand. Off: no Partner section (Clients, Whitelabel), no Partner routes. |
| `modules.ai` | Models by name, conversations, assistants, the chat widget. |
| `modules.knowledge` | Knowledge bases and hybrid search. Needs `ai`. |
| `modules.automation` | Runs, schedules, Tasks, Autopilot, the Activity page. |
| `modules.seo` | Local SEO: Locations, Google Maps grids, Google search, AI answers, competitors, suggestions, SEO onboarding. Needs `automation`. Plans sell it with `limit.seo_locations`, `limit.seo_keywords` and `limit.seo_questions` (per Location), `limit.seo_grid_size` (5, 7 or 9) and `limit.seo_checks_per_month` (daily 30, weekly 4, monthly 1); a missing limit is unlimited. |
| `auth.magicLink` | Passwordless sign-in links. Needs the app to send email. |
| `auth.openSignUp` | Off: people join only by invitation, or an admin creates them. |
| `auth.verifyEmail` | Send a confirmation after sign-up (when the app can send email). Not required to sign in. |
| `features[]` | The switches each Organization sees in Settings → Features, and a Plan can grant (`feature.<id>`). `module` ties a feature to an optional module. |

Turning a module off removes its tables from the next `bun run db:generate`, its routes from the API and docs, its jobs from the worker, and its pages from the web bundle. Turning one on again brings them back; its data was never deleted unless you dropped the tables. Under `bun test` every module is on, whatever this file says (`bunfig.toml`).

## deploy.config.json

| Key | What it does |
|---|---|
| `repo` | `owner/name` on GitHub: the image's name, and where the secrets go. |
| `server`, `sshUser` | The VPS. The user needs to be able to install Docker. |
| `apiDomain`, `appDomain`, `siteDomain` | The three addresses. `siteDomain` may be empty. |
| `adminEmail` | `ADMIN_EMAILS` in production. |

`bun run deploy:setup` writes this and fills `config/deploy.yml`, `.kamal/hooks/pre-deploy` and `apps/web/vercel.json` from it. To change one, run the command again.

## .env

Everything is checked at boot (`packages/kernel/src/config.ts`): a bad value lists every problem and stops the process.

| Variable | Required | What it does |
|---|---|---|
| `NODE_ENV` | | `development`, `test` or `production`. Production requires https everywhere. |
| `DATABASE_URL` | yes | Postgres. Local Docker (`bun run db:up`) or Neon. In production, Neon's direct address; the pooled one is refused at boot. |
| `BETTER_AUTH_SECRET` | yes | Signs sessions and tokens. 32+ characters. |
| `MASTER_KEY_CURRENT`, `MASTER_KEY_V<n>` | yes | Envelope encryption for provider secrets. Rotate by adding `V2` and pointing `CURRENT` at it. |
| `BETTER_AUTH_URL` | | The API's own public address (default `http://localhost:3000`). The chat widget's embed code points here. |
| `APP_URL` | | The web app's address (default `http://localhost:5173`): a trusted origin, and where emails link to. In development the site's Sign in goes to this same address (`bun dev` sets `VITE_APP_URL` for the site). |
| `SITE_URL` | | The site's address, if it calls the API. |
| `TRUSTED_ORIGINS` | | Extra browser origins that may call with cookies. |
| `PORT` | | API port (default 3000). |
| `ADMIN_EMAILS` | | People who are app admins at sign-up, and existing accounts promoted at boot. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | | Google sign-in, and the OAuth client Organizations connect their Google Business Profile with. Both, or neither. Add `APP_URL/api/v1/oauth/google_business/callback` to the client's redirect URIs. Without them, connecting a Google profile makes a stub Connection. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | | Stripe for the billing module. Checkout needs the key; webhooks need the webhook secret. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | | Cloudflare Turnstile before the chat widget starts a conversation. Both, or neither. |
| `FILES_S3_BUCKET`, `FILES_S3_ACCESS_KEY_ID`, `FILES_S3_SECRET_ACCESS_KEY` | | An S3-compatible bucket for files kept outside the database (ADR 0035): AWS S3, Cloudflare R2, MinIO. All three, or none. Add `FILES_S3_ENDPOINT` for anything but AWS, and `FILES_S3_REGION` if it needs one. |
| `FILES_DIR` | | A folder for those files instead of a bucket; relative paths are from the repository's root. In production it must be a mounted volume, or it empties on each deploy. Development uses `.data/files` when neither is set; elsewhere, with neither, nothing is kept. |
| `PROVIDER_ORIGINALS_DAYS` | | Days DataForSEO's untrimmed responses are kept (default 400; `0` for good). A daily job deletes older ones. |
| `TEST_DATABASE_URL` | | Where `bun test` creates and drops databases (default: the local Docker server). |
| `SEED_PASSWORD` | | Password for the seed's users (default `password-123`). |

Services turn themselves on when their variables are set: the sign-in page shows Google only with its keys, Settings → Billing offers checkout only with Stripe, the widget asks for Turnstile only with its keys.

## The chat widget in the app

Which widget the chat button inside the app answers as is not an environment variable; it is chosen in the app, by the people who build the widget (ADR 0031). Out of the box every Organization uses its built-in widget: no instructions, the app's default model (Platform admin → Models). To give the app a help bot, build a widget under Widgets, attach its knowledge bases, then choose **Use in the app** on its page (for your Organization and its Clients) or **Use for everyone in the app** (app admins; also in Platform admin → Models). Choose a model for it with the widget's Model field, or leave it on the default.

## Providers: stub or live

Every provider adapter has a stub that answers with made-up data and no network call, so the app works end to end with no vendor account (ADR 0013). Each Connection has its own mode (ADR 0029). A platform admin chooses it in Platform admin → Connections when connecting, and can switch it later. A key an Organization adds in Settings → Integrations is live. A Connection made in code is a stub unless the code says otherwise, so tests never reach a vendor. The seed connects SMTP live (Mailpit, on this machine), and Anthropic and OpenAI as stubs; to use real models, disconnect a seeded one and connect it again with a real key.

## Where provider accounts live

Search data for the SEO module (**DataForSEO**: login and password) and finding a business (**Google Places**: an API key) are the app's own Connections only, in Platform admin → Connections: Organizations can't bring their own, and pay for SEO through their Plan's limits. Every live DataForSEO response is also kept whole as a file, when the app has a file store (`FILES_*`), so fields we don't read yet can be read later for past checks (ADR 0035). Their usage is recorded as cost-only meters (`seo.requests`, `places.requests`): Platform admin → SEO costs reads them, Plans never block them. Both are stubs until connected live; the stub answers from a made-up market of dental practices in Austin, so every Location set up in stub mode lives there.

Keys for email, models and Slack are **Connections** (Settings → Integrations for an Organization, Platform admin → Connections for the app's own), encrypted at rest. Platform admin → Models shows the model vendors from the same Connections with everything else about models: the models each connected vendor offers (asked of the vendor's own API, kept ten minutes), the app's model names and its default. Stripe, Google sign-in and Turnstile are the app's own services and come from `.env`, because Better Auth and the billing routes need them at boot.
