# Docs

How documentation is organised, and the rules for keeping it current. People and AI agents read and update it alongside the code.

| Path | What's in it |
|---|---|
| [architecture.md](architecture.md) | The shape of the code, a request's path, the worker, the data model's conventions. |
| [configuration.md](configuration.md) | Every switch in `app.config.ts` and every variable in `.env`. |
| [modules.md](modules.md) | How to add a module, a provider, a feature switch, a Task kind, an app setting. |
| [deploy.md](deploy.md) | Production: Neon, the VPS with Kamal, Vercel for the web app and site. |
| [GLOSSARY.md](GLOSSARY.md) | The words the code and docs use. |
| [../apps/web/DESIGN.md](../apps/web/DESIGN.md) | The web app's design system: tokens, components and the rules for new screens. |
| [decisions/](decisions/) | Architecture decision records (ADRs), one numbered log. |
| [features/](features/) | One folder per product feature: what it does, its data model. [SEO](features/seo/README.md) is the first. |
| [_template/](_template/) | What a feature folder's docs start from, for products with many features. |

Module behaviour is documented in the module itself: a header comment in `src/module.ts` says what it owns, and each service file says what it does. Tests in `modules/<id>/test` are the executable spec.

## Rules for AI agents

1. **Read before you change.** A module's `module.ts` and the relevant service, then its tests.
2. **Update in the same change.** Behaviour, data shapes, permissions or configuration changed means the matching doc changed in the same commit.
3. **Glossary first.** A new domain term goes in [GLOSSARY.md](GLOSSARY.md) before it appears in code.
4. **Decisions go in [decisions/](decisions/).** A settled design question is an ADR; a changed decision supersedes the old one, never edits it.
5. **Never claim a stub is live.** A Connection is a stub until it is set live; docs say so where it matters.

## Voice

Plain words, short sentences. Say what something does, not how great it is. Name screens by their on-screen labels. The product may be whitelabelled by a Partner, so end-user text never names the app or the assistant.
