# Repository

A boilerplate for one SaaS app, forked per product: an API and worker (`apps/api`, `apps/worker`) built from modules (`modules/*`) on a small kernel (`packages/*`), a web app (`apps/web`) and a marketing site (`apps/site`). Words: [docs/GLOSSARY.md](docs/GLOSSARY.md).

## Before you work on anything

1. Read [docs/README.md](docs/README.md) (how docs are organised) and [docs/architecture.md](docs/architecture.md).
2. For a module, read its `src/module.ts` first: the manifest says what it owns and offers.
3. Settled design questions are ADRs in [docs/decisions](docs/decisions/); [0022](docs/decisions/0022-a-boilerplate-not-a-platform.md) is the current strategy.

## How we build

- **Co-locate by feature.** Everything a module owns (schema, service, routes, jobs, events, tests) lives in `modules/<id>/`. Code moves to `packages/shared` only once two modules need it.
- **Optional modules stay optional.** Core modules never import an optional one. They reach billing and knowledge through the kernel's hooks (`billingOf(ctx)`, `knowledgeOf(ctx)`), which have no-op defaults. A fork with a module off must still build, boot and pass `bun run check`.
- **The frontend reaches the API over HTTP only.** `apps/web` imports types from `@app/server` and the pure `@app/shared`; nothing else from the API. Pages of an optional module sit behind its `__MODULE_X__` flag so they drop from the bundle when it's off.
- **Every piece is a deployable slice.** `bun run check` green, migrations applying to an empty database (`bun run db:reset`), API and worker booting, docs updated.
- **Messages and files use the shared components.** Results appear beside the action (`Feedback`) or as a toast, never at the top of a page; files use `FileInput` ([ADR 0030](docs/decisions/0030-feedback-beside-the-action.md)). `bun run check` enforces it.
- **Maintainability first.** Prefer the clearer design over the quicker one; small modules with narrow interfaces; names from the glossary.

## When you change code

Update the matching docs in the same change: `docs/architecture.md` for the shape, `docs/configuration.md` for a new switch or variable, `docs/modules.md` for a new extension point, the module's own comments for behaviour. A settled design question becomes an ADR. A schema change needs `bun run db:generate` and the new migration committed.
