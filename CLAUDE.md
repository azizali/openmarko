# OpenMarko

Marketing platform for local businesses and the agencies that serve them. Today it is a clickable mock (`ui-mock/`) with no backend, plus a marketing site (`site/`).

## Before you work on anything

1. Read [docs/README.md](docs/README.md): how the docs are organised and the rules for keeping them current.
2. Read [docs/product-map.md](docs/product-map.md) to find the feature or platform area you're touching and what depends on it.
3. Read that area's `README.md` and `technical.md` under `docs/features/<id>/` or `docs/platform/<id>/`.
4. Use the words in [GLOSSARY.md](GLOSSARY.md).

## When you change code

Update the matching docs in the same change: `technical.md` for behaviour, data or permissions; `roadmap.md` for status and a changelog line; frontmatter `status`, `depends_on`, `code`, `last_verified`; `product-map.md` if status or dependencies changed. A new `FeatureId` needs actions in `ui-mock/src/data/access.ts` and a docs folder copied from `docs/_template/`.

Never mark something built because it works in the mock. Everything is `mock` until a backend or real provider is behind it.
