---
id: citations
kind: feature
module: seo
status: mock
depends_on: [seo]
capabilities: []
permissions: citations
code:
  - ui-mock/src/pages/Citations.tsx
  - ui-mock/src/data/authority.ts
related: [ai-answers, rankings, automation, sales]
last_verified: 105911e
---

# Citations & backlinks

Where the business is listed online and whether the details match (citations), and which sites link to its website (backlinks). Page: `/citations` (Backlinks at `?tab=links`).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Citation health score | `mock` |
| 18 key directories with status: correct / wrong info / missing / duplicate | `mock` |
| Which rivals are listed, AI-cited flag (directories AI answers lean on), how it's fixed (direct API, aggregator, partner submission, claim yourself) and cost | `mock` |
| Bulk **Fix & build** | **stub** |
| Backlinks: referring domains vs. the leader over time, new/lost links | `mock` |
| Link-gap opportunities (sites linking to 2+ rivals, not you), local link ideas, outreach drafts and status | `mock` |
| Autopilot: "Correct directory listings" (default Ask first) | `mock` |

## How it connects

- **Needs:** a Location (citations); a Website (backlinks).
- **Feeds:** Ranking factors (links and citations groups), AI answers (cited sites), To-do.
- **Turned off:** `/citations` hides.
