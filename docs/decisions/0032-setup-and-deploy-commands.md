# 0032. A fork is set up and deployed by two commands

- Status: Accepted
- Date: 2026-11-09
- Affects: tooling, scripts, deploy, tests

## Context

Forking meant copying secrets by hand, then repeating the same domains and image name across `config/deploy.yml`, the pre-deploy hook and `vercel.json`, and clicking through GitHub and Vercel. A new production database also had no Plan and no way to make the first admin when sign-up was closed.

## Decision

- `bun run setup` takes a fresh fork to the app running locally. `bun run deploy:setup` takes it to production. Both ask questions, and both are safe to rerun.
- `deploy.config.json` (committed, nothing secret) holds where the app deploys. `deploy:setup` fills the deploy files from it. They stay ordinary files that Kamal and Vercel read directly, with no template step at deploy time.
- Production's secrets live in `.env.production` (not committed) and are pushed to GitHub's secrets. Pushing to `main` remains the only way to deploy.
- `deploy:setup` checks the database, DNS and SSH before it changes anything.
- The first admin is made by `bun run admin:create`, outside sign-up. A generated password is shown once, as soon as it exists.
- `scripts/bootstrap.ts` runs after migrations on each deploy and adds the first Plan to an empty table. It never changes Plans that exist.
- Local forks share one Postgres on port 5433, each with its own database.
- Under `bun test` every optional module is on (`bunfig.toml`), so a fork's choice of modules can't fail CI and block its deploy. A test checks that the core stands alone with them off.

## Consequences

- A fork deploys with `gh` and `vercel` signed in, a VPS and a Neon database, and no Ruby or Kamal on the laptop.
- The commands edit known lines of checked-in files. Changing those lines' shape means changing `tooling/lib/config-files.ts`, whose tests read the real files.
- `deploy:setup` uses `vercel api`, which is in beta in Vercel's CLI.
- Tests run with every module on, so they prove the core stands alone only through the manifests test. A fork that turns a module off should still look at the running app.
