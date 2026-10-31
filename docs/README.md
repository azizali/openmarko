# OpenMarko docs

Product and technical documentation for OpenMarko, kept in the repo so people and AI agents read and update it alongside the code.

Words follow [GLOSSARY.md](../GLOSSARY.md). Docs use its terms and link to it; they never redefine them.

## Where things are

| Path | What's in it |
|---|---|
| [product-map.md](product-map.md) | Every module, feature and platform area, its status, and how they depend on each other. **Start here.** |
| [data-model.md](data-model.md) | Shared entities (Organization, Location, Member, Connection…) and where each lives today. |
| [decisions/](decisions/) | Architecture decision records (ADRs), one per file. |
| [platform/](platform/) | Shared infrastructure every feature leans on: organizations and Partners, access and roles, integrations, whitelabel, the app shell, automation, brand voice and skills, onboarding, reports. |
| [features/](features/) | One folder per `FeatureId` in [ui-mock/src/data/features.ts](../ui-mock/src/data/features.ts). |
| [research/](research/) | Market and competitor research. Not product docs. |

## Files in each folder

| File | For | Contents |
|---|---|---|
| `README.md` | product team, AI entry point | What it is, who it's for, what it can do, with frontmatter. Required. |
| `technical.md` | engineers, AI | Data shapes, stores, code map, integrations and capabilities, permissions, what the real build needs. Required. |
| `guide.md` | end users | Task-based how-tos. Whitelabel-neutral (see below). |
| `roadmap.md` | everyone | Current state, what's stubbed, what's left to build, open questions, changelog. |

## Frontmatter (every README.md)

```yaml
---
id: reviews                 # FeatureId from data/features.ts, or the platform folder name
kind: feature               # feature | module | platform
module: seo                 # parent module, features only
status: mock                # see Status below
depends_on: [seo]           # must be on for this to work (module + needsAny)
capabilities: [reviews.read, reviews.reply]   # data/integrations.ts CapabilityIds it uses
permissions: reviews        # Resource in data/access.ts
code:                       # files an agent should read first
  - ui-mock/src/pages/Profile.tsx
related: [marko, automation]
last_verified: 105911e      # commit the doc was last checked against
---
```

## Status

| Status | Meaning |
|---|---|
| `idea` | Not in the mock. Described in a roadmap only. |
| `mock` | Clickable in [ui-mock/](../ui-mock/) with mock data. Nothing talks to a backend or a real provider. |
| `building` | Backend work has started. `roadmap.md` says which parts are real. |
| `live` | Real in production. |
| `deprecated` | Being removed; `roadmap.md` says what replaces it. |

**Everything is `mock` today.** There is no backend, no database, no auth and no real third-party calls. The mock goes further than static screens, though: state is kept in `localStorage` or in memory, timers stand in for webhooks, and pages react to each other. Each `roadmap.md` lists exactly what is **stubbed** (behaves like the real thing in the mock but isn't built) so nobody mistakes a working-looking mock for a built feature.

Within a doc, mark individual capabilities with the same words when they differ from the folder's status, e.g. "Share links: `mock` (stub: token encodes the path; views kept in this browser)".

## Voice

- **guide.md is whitelabel-neutral.** Partners can rebrand the app, so guides never say "OpenMarko" or "Marko". Say "the app", "the assistant", "your agency". Name screens by their on-screen labels.
- README and technical docs may name code identifiers (`marko`, `OpenMarko sending`) but call the assistant "the assistant" in prose.
- Plain words, short sentences. Say what something does, not how great it is.

## Rules for AI agents

1. **Read before you change.** Before editing a feature's code, read its `README.md` and `technical.md`. Find the folder from the `code:` list in frontmatter, or from the `FeatureId`.
2. **Update in the same change.** If you change behaviour, data shapes, permissions, dependencies or status, update `technical.md`, `roadmap.md` (changelog line) and the frontmatter in the same commit. Update [product-map.md](product-map.md) if status or dependencies changed.
3. **Bump `last_verified`** to the commit you checked against when you confirm a doc still matches the code.
4. **Never mark something built because it works in the mock.** `building` or `live` needs a backend or real provider behind it. Keep stub call-outs until the stub is gone.
5. **Glossary first.** New domain terms go in [GLOSSARY.md](../GLOSSARY.md) before they appear in docs or code.
6. **Decisions go in [decisions/](decisions/).** If a change settles a design question, add an ADR and link it from the feature's `technical.md`.
7. **New feature or platform area:** copy [_template/](_template/) into `features/<id>/` or `platform/<id>/`, fill the frontmatter, add a row to [product-map.md](product-map.md).

## Naming

- Folders: kebab-case of the `FeatureId` (`ai_answers` → `ai-answers`). Platform folders: kebab-case area names.
- Files: the four fixed names above, lowercase. Extra material goes in the same folder with a descriptive kebab-case name (`grid-scan-costs.md`) and is linked from `technical.md`.
- ADRs: `decisions/NNNN-short-title.md`, numbered in order.
