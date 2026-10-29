# Groundwork: local SEO (mock scaffold)

Clickable mock of a local rank-tracking tool that tracks your Google Business Profile, benchmarks competitors, suggests improvements and applies them. All data is mock (`src/data/mock.ts`). The intended DataForSEO and Google endpoints are listed in `src/lib/api.ts`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Routes

| Route | What it shows |
| --- | --- |
| `#/onboarding` | Find business → connect GBP / Search Console / GA4 (mock OAuth + property picker) → pick keywords → competitors → grid size/radius/cost → first-scan progress |
| `#/` | Overview: SoLV, map rank, GSC clicks, GBP calls, visibility chart, mini grid, next actions, movers, activity |
| `#/rankings` → `/:id` | Organic + map pack table with 7-day deltas, filters, sort → keyword history chart, current pack, SERP, how to move up |
| `#/grid` | Geo-grid rank pack (5/7/9), ARP/ATRP/SoLV, click a point to see that point's top 3, before/after compare, new-scan cost modal |
| `#/competitors` → `/:id` | Benchmark table → head-to-head, category gaps, keyword overlap |
| `#/factors` | Weighted factor groups (GBP, reviews, on-page, links, citations, behavioral) with “Fix” links into actions |
| `#/audit` → `/:id` | Health score, Core Web Vitals, issues by severity/category → diff preview, choose pages, apply via WordPress, roll back |
| `#/keywords` | Ideas / questions / competitor gap / near-me, select → track |
| `#/actions/:id` | Board/list of improvements, autopilot, drawer: why, evidence, editable change, approve & apply with step log |
| `#/profile` | GBP insights, completeness, AI review replies, post composer/scheduler |
| `#/reports`, `#/settings` | Scheduled reports + preview; integrations, DataForSEO creds/balance, automation permissions, team, usage |

Press `⌘K` for the command palette. Dark mode toggle is in the sidebar.

## Structure

```
src/
  components/ui.tsx      Buttons, cards, badges, deltas, tabs, drawer, modal, SVG charts
  components/Layout.tsx  Sidebar, location switcher, ⌘K, theme
  components/GridMap.tsx Geo-grid renderer (swap backdrop for MapLibre tiles)
  data/mock.ts           All mock data, typed
  lib/api.ts             Endpoint map, grid coordinate math, cost estimate
  pages/*                One file per route
```

## Next steps toward a real build

1. Add a backend (e.g. Hono or Next.js route handlers) that holds DataForSEO Basic auth and Google OAuth tokens. Never call either API from the browser.
2. Grid scans: `gridCoordinates()` → one `serp/google/maps` task per point (`location_coordinate: "lat,lng,15z"`). Use the standard queue and a postback for cost.
3. Store scans/rankings in Postgres; compute deltas server-side.
4. Executors: GBP Business Information API (`PATCH locations/{id}?updateMask=…`), v4 reviews/localPosts, WordPress REST. Log every change with a revert payload.
