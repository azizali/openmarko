# 0020. Production deploys run Kamal from CI, migrating from the deploy machine

- Status: Accepted
- Date: 2026-11-07
- Affects: deploy, kernel (config)
- Builds on: [0007](0007-backend-stack.md) (stack)

## Context

The API and worker need one production server early, so every later piece can be tried on a real URL. Kamal 2 was chosen for the server. That left open how a deploy runs, how migrations run before new containers start, and how the server pulls a private image.

## Decision

1. **Kamal from GitHub Actions.** `.github/workflows/ci.yml` runs `bun run check` on every push. On a green push to `main` (once the `DEPLOY` variable is `true`) it runs `kamal setup` from the repository root (`config/deploy.yml`). `setup` is `deploy` plus installing Docker where it's missing, so a new server needs no separate first run. One deploy at a time.
2. **One image, two roles.** `api` (behind kamal-proxy, which gets a Let's Encrypt certificate for the API host) and `worker` (`no-healthcheck`, because the image's healthcheck asks the API on port 3000).
3. **Migrations from the deploy machine.** The `pre-deploy` hook (`.kamal/hooks/pre-deploy`) runs `scripts/migrate.ts` and `scripts/bootstrap.ts` in the just-pushed image, with `docker run` on the machine that deploys, after the push and before any container starts. A failed migration stops the deploy and the old version keeps serving. Not `kamal app exec`: Kamal 2.12 reuses the env file the last boot left on the server (none on the first deploy) and runs once per role.
4. **Registry login with CI's own token.** Images go to GitHub's container registry (private), pushed and pulled with the workflow's `GITHUB_TOKEN` (`packages: write`). The image's `org.opencontainers.image.source` label links the package to the repository. No long-lived registry token exists. The server pulls only during a deploy, while the token is valid.
5. **Secrets.** GitHub Actions secrets hold the app's secrets and `SSH_PRIVATE_KEY` (a key used only for deploys). `.kamal/secrets` only copies them from the environment and holds no values.
6. **Direct database connection.** `DATABASE_URL` uses Neon's direct endpoint (no `-pooler`), with `sslmode=verify-full`. pg-boss and the migration step use session-level locks, which a transaction pooler breaks.

## Consequences

- Deploying from a laptop works the same way: export the same variables and run `kamal deploy` from the repository root.
- A second server or a staging destination is a `deploy.yml` change, not a pipeline change.
- After the first deploy, migrations are frozen: every schema change is a new migration.
- [0032](0032-setup-and-deploy-commands.md) fills in the per-fork values (hosts, image) with `bun run deploy:setup`.
