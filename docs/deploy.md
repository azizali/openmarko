# Deploy

Three deployables: the API image (API and worker, one VPS, Kamal), the web app (Vercel) and the site (Vercel). The database is a managed Postgres with pgvector (Neon).

## The short way

```sh
bun run deploy:setup
```

You need `gh` and `vercel` signed in, SSH access to a VPS, an A record for the API's domain pointing at the VPS, and a Neon project. The command:

1. Asks for the VPS, the three domains, your email, the Neon connection string and any AI keys. It keeps your answers in `deploy.config.json`, so a rerun offers them again.
2. Checks the database (and refuses Neon's pooled address), DNS and SSH. If one fails, nothing has changed.
3. Fills `config/deploy.yml`, the pre-deploy hook and `apps/web/vercel.json`.
4. Writes production's secrets to `.env.production`, which is not committed. **Keep a copy somewhere safe:** without `MASTER_KEY_V1` the provider keys stored in the database can't be read.
5. Applies migrations to Neon, adds the first Plan, makes your admin account (the password is shown once) and connects your AI keys.
6. Makes a deploy key just for this app, adds it to the VPS, and sets GitHub's secrets.
7. Creates the Vercel projects (`<slug>-app`, `<slug>-site`) linked to the repository, and lists the DNS records to add.
8. Offers to commit the deploy files and push, then watches the first deploy.

To add Google sign-in, Stripe or Turnstile in production, put their variables in `.env.production` and run it again.

After a deploy, connect an email provider in Admin → Connections. Until then, no verification, reset or invitation emails go out.

To make another admin later: `DATABASE_URL=... bun run admin:create someone@example.com`, with the other variables from `.env.production` set.

The rest of this page is what that command does, for doing a part by hand.

## Database (Neon)

1. Create a project with Postgres 17; enable the `vector` extension (the first migration runs `create extension if not exists vector`, which Neon allows).
2. Take the direct (non-pooled) connection string as `DATABASE_URL`. pg-boss and Better Auth's migration want a direct connection.

## API and worker (Kamal on a VPS)

1. A server with SSH as root and Docker (Kamal installs it on `kamal setup`). Point `api.example.com` at it.
2. `config/deploy.yml`: set `image` (your GitHub user and repository), the server's address, `proxy.host`, `BETTER_AUTH_URL`, `APP_URL`, `SITE_URL` and `ADMIN_EMAILS`. Provider keys go in Admin → Connections after the first deploy. `.kamal/hooks/pre-deploy`: the same image name.
3. Secrets, as GitHub Actions repository secrets: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MASTER_KEY_V1`, `SSH_PRIVATE_KEY`, and the optional `GOOGLE_*`, `STRIPE_*`, `TURNSTILE_*`. Set the repository variable `DEPLOY=true` to turn the deploy job on.
4. Push to `main`. `.github/workflows/ci.yml` runs the checks, builds the image, runs migrations and `scripts/bootstrap.ts` from the deploy machine (the pre-deploy hook), then starts the new containers behind kamal-proxy with a Let's Encrypt certificate.

From a laptop instead: export the same variables and run `kamal setup` (first time) or `kamal deploy`.

The image's default command is the API; the `worker` role runs `bun apps/worker/src/index.ts`. Logs: `kamal app logs -r api` and `-r worker`.

## Web app (Vercel)

Import the repository as a Vercel project with root directory `apps/web`, framework Vite, build `bun run build`, output `dist`. In `apps/web/vercel.json`, point the `/api/*` and `/widget/*` rewrites at your API's domain: the browser then calls its own origin, and the session cookie stays first-party. The chat widget's embed code loads straight from the API's domain (`BETTER_AUTH_URL`); the `/widget/*` rewrite only keeps older pasted snippets working. Add the app's domain as `APP_URL` in the API's deploy config.

## Site (Vercel)

A second Vercel project with root directory `apps/site`. Set `VITE_APP_URL` to the web app's address so "Sign in" and every call to action go there.

## Email

Until the app can send, sign-up works but no verification, reset or invitation emails go out. Connect an email provider in Admin → Connections and set the sender in Admin → Settings; Admin → Email says when it's ready and sends a test.

## Checklist before going live

- `NODE_ENV=production` and https for every URL (the config refuses otherwise).
- An admin exists: `bun run admin:create`, or `ADMIN_EMAILS` names you and you sign up.
- The first Plan comes from the deploy. Set your real limits in Admin → Plans & usage.
- Stripe's webhook endpoint at `https://api.example.com/api/v1/webhooks/stripe` with `STRIPE_WEBHOOK_SECRET`.
