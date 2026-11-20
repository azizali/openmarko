# 0020. Production deploys run Kamal from CI, migrating from the deploy machine

- Status: Accepted
- Date: 2026-11-07
- Affects: platform (deploy), platform/kernel (config)
- Builds on: [0007](0007-backend-stack.md) (stack), [0018](0018-isolation-by-process-groups-and-cells.md) (one image, process groups), [0019](0019-a-request-is-named-by-its-key-or-its-domain.md) (Project domains)

## Context

Plan item 9.0 puts the platform on one production server early, so every later piece can be tried on a real URL. The plan fixed the server, the hosts, the database and Kamal 2. It left open how a deploy runs, how migrations run before new containers start, and how the server pulls a private image. The production config rule "TRUSTED_ORIGINS is required" also no longer fit: since 2.3 each Project trusts its own app domains.

## Decision

1. **Kamal from GitHub Actions.** `.github/workflows/platform.yml` runs `bun run check` on every push. On a green push to `main` it runs `kamal setup` from `platform/` (`platform/config/deploy.yml`). `setup` is `deploy` plus installing Docker where it's missing, so a new server needs no separate first run. One deploy at a time.
2. **One image, two roles.** The repository is `azizali/mkitup` (the platform with its Projects); the image is `ghcr.io/azizali/mkitup`. `web` (the API, behind kamal-proxy, which serves every API host with Let's Encrypt) and `worker` (`--no-healthcheck`, because the image's healthcheck asks the API on port 3000).
3. **Migrations from the deploy machine.** The `pre-deploy` hook runs `bun platform/scripts/migrate.ts` in the just-pushed image, with `docker run` on the machine that deploys, after the push and before any container starts. A failed migration stops the deploy and the old version keeps serving. Not `kamal app exec`: Kamal 2.12 reuses the env file the last boot left on the server (none on the first deploy) and runs once per role.
4. **Registry login with CI's own token.** Images go to `ghcr.io/azizali/mkitup` (private), pushed and pulled with the workflow's `GITHUB_TOKEN` (`packages: write`). The image's `org.opencontainers.image.source` label links the package to the repository. No long-lived registry token exists. The server pulls only during a deploy, while the token is valid.
5. **Secrets.** GitHub Actions secrets hold `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MASTER_KEY_V1`, `PLATFORM_ADMIN_TOKEN` and `SSH_PRIVATE_KEY` (a key used only for deploys). `platform/.kamal/secrets` only copies them from the environment and holds no values.
6. **Direct database connection.** `DATABASE_URL` uses Neon's direct endpoint (no `-pooler`), with `sslmode=verify-full`. pg-boss and the migration step use session-level locks, which a transaction pooler breaks.
7. **`TRUSTED_ORIGINS` is optional in production.** It now means "origins every Project trusts" (a platform frontend such as the console). Values must still be https in production.

## Consequences

- Deploying from a laptop works the same way: export the five variables and run `kamal deploy` from `platform/`.
- A second server or a staging destination is a `deploy.yml` change, not a pipeline change.
- Every new Project API domain must be added in two places: `proxy.hosts` in `deploy.yml` (for its certificate) and the admin API (2.3). Partner hosts will use on-demand TLS instead (ADR 0019).
- After the first deploy, migrations are frozen: every schema change is a new migration.
