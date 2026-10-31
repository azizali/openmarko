---
id: site_health
kind: feature
module: seo
status: mock
depends_on: [seo]
capabilities: [site.write, search.read]
permissions: site_health
code:
  - ui-mock/src/pages/Audit.tsx
  - ui-mock/src/pages/AuditIssue.tsx
related: [automation, rankings, content]
last_verified: 105911e
---

# Site health

Technical issues on the Website and one-click fixes. Pages: `/audit`, `/audit/:id`.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Health score, Core Web Vitals (mobile; field data where available, otherwise Lighthouse) | `mock` |
| Issues by severity and category | `mock` |
| Issue detail: why it matters, affected pages, diff preview, choose pages, apply via WordPress, roll back | **stub** |
| Autopilot: image alt text (default On its own), structured data (default Ask first) | `mock` |
| Re-crawl site | **stub** |

## How it connects

- **Needs:** a Website for the scoped Location; WordPress to apply fixes (Squarespace sites are fixed by hand).
- **Feeds:** To-do, Reports (site audit), Ranking factors (on-page).
- **Turned off:** `/audit` hides.
