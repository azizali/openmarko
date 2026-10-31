---
id: marketing-site
kind: platform
status: mock
depends_on: []
capabilities: []
permissions: public
code:
  - site/src/App.tsx
  - site/src/data/site.ts
  - site/src/data/services.ts
  - site/src/data/competitors.ts
  - site/src/data/stories.ts
  - site/src/pages
related: [home-reports]
last_verified: 105911e
---

# Marketing site

The public website in [site/](../../../site/): home, services, comparison pages, customer stories and pricing. A separate Vite + React app; links to the app at `https://app.openmarko.com`.

**Status: `mock`.** Built and browsable; content is draft.

## Pages

| Route | Page |
|---|---|
| `/` | Home (with `#how` services section) |
| `/services/:slug` | One service |
| `/compare`, `/compare/:slug` | OpenMarko vs competitors |
| `/customers`, `/customers/:slug` | Case studies |
| `/pricing` | Plans: Local $99, Agency $299, Agency Max $599 (+ "The Map Pack Promise" offer) |

## Rules that must hold before launch

- **`SAMPLE_CONTENT = true`** in `site/src/data/site.ts`: OpenMarko has no customers yet, so every story is built from the mock's fictional businesses and labelled "Sample story". Replace with real, consented stories and set it to false. Publishing invented testimonials as real breaks the FTC rule on fake reviews.
- Competitor facts come only from [docs/research/reports/Local SEO competitor landscape.md](../../research/reports/Local%20SEO%20competitor%20landscape.md); "?" means unconfirmed. Re-check before publishing.
- Pricing follows hypotheses in [docs/research/origami-and-openmarko-gtm.md](../../research/origami-and-openmarko-gtm.md); confirm before launch.
