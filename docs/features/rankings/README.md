---
id: rankings
kind: feature
module: seo
status: mock
depends_on: [seo]
capabilities: [search.read]
permissions: rankings
code:
  - ui-mock/src/pages/Rankings.tsx
  - ui-mock/src/components/KeywordTable.tsx
  - ui-mock/src/components/GridMap.tsx
  - ui-mock/src/pages/Competitors.tsx
  - ui-mock/src/pages/CompetitorDetail.tsx
  - ui-mock/src/pages/Factors.tsx
  - ui-mock/src/pages/Keywords.tsx
related: [seo, automation, sales, home-reports, ai-answers]
last_verified: 105911e
---

# Rankings & competitors

Keyword and map pack tracking, competitors, ranking factors and keyword ideas for each Location. Pages: `/rankings`, `/competitors`, `/competitors/:id`, `/factors`, `/keywords`.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| **Rankings**: one table for organic and map pack; views All / Organic / Map pack; filters improved / declined / top 3, keyword search, topic tags | `mock` |
| Each row has a mini map grid; open it for the full geo-grid (tap a point; 5×5 / 7×7 / 9×9; now vs 30 days), history, Google results | `mock` |
| Deep links `?view=local&kw=kw_3`; `/grid` redirects | `mock` |
| Run scan button with live progress | **stub** |
| **Competitors**: benchmark table (rating, reviews, review velocity, photos, categories, average grid rank, share of local voice, posts, domain rank, backlinks, distance) → head-to-head with gaps to close, their categories, keyword overlap | `mock` |
| **Ranking factors**: weighted groups (Business Profile, reviews, on-page, links, citations, behavioral) with scores and "Fix" links into To-do | `mock` |
| **Keyword ideas**: Ideas / Questions / Competitor gap / Near-me tabs, select → track; **Generate more ideas** adds the next batch marked New | `mock` |

## How it connects

- **Needs:** a Location (public search data only).
- **Feeds:** Home (map pack, Presence score), Reports (keyword progress), To-do (factor fixes), AI answers (questions linked to keywords), Articles (keywords without an article), the sales audit's grid.
- **Turned off:** Rankings, Competitors, Factors and Keyword ideas pages hide.
