# Groundwork: local SEO (mock scaffold)

Clickable mock of a local rank-tracking tool that tracks your Google Business Profile, benchmarks competitors, suggests improvements and applies them. All data is mock (`src/data/mock.ts`). The intended DataForSEO and Google endpoints are listed in `src/lib/api.ts`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Routes

Everything except `#/` and `#/onboarding` is a *deep dive* (collapsible in the sidebar).

| Route | What it shows |
| --- | --- |
| `#/onboarding` | Find business → connect GBP / Search Console / GA4 (mock OAuth + property picker) → pick keywords → competitors → grid size/radius/cost → first-scan progress |
| `#/` | **Command Center**: top area in two layouts (Story: a plain-English sentence, weekly customer-actions chart and Google results beside a scorecard list; Ledger: compact columns with sparklines). Both include the Local presence score (map pack, Google, website, reviews, AI answers), a score bar per area, Google profile results and a “Fix these” bar. “Up next” (top to-do), keywords & map pack table (shared with Rankings), site health section, blog + GBP posts. Opening a keyword shows its map, a competitor comparison for that keyword (click a business to load its map in place), history and Google results. Clicking a keyword focuses the page on it. |
| `#/prospects` | **Prospecting**: search keyword + city, every business in the map pack scored by ease of sale (rank 4–15, quick fixes under an hour, good rating, no agency, runs ads). Every row has a map thumbnail and expands into that business's map vs. the top 3 (switch in place). Top pick card shows its map beside the leader's. Searches are logged as runs. Filters (low-hanging fruit, no website, unclaimed, no agency), sort by ease / value / rank |
| `#/prospects` (saved, no-website, direct audit) | **Saved searches & audits**: every search and direct audit is saved (localStorage in the mock) and listed above the search; reopening one is free, a banner shows when it was fetched with a Refresh button, pin or remove entries, and coming back to Prospecting reopens your last search. **No website only** toggle: DataForSEO Business Listings search with filter `["url", "=", null]`, plus the top 3 for comparison. **Audit a business** (also in ⌘K, or `?new=audit`): name or Google Maps link + city → pick the right listing → keyword → audit, no prospecting search needed |
| `#/a/:token` | **Shared audit link** (public, no app chrome): the sales audit written to “you”, without contact details or the pitch, with “Book a 15-min walkthrough” and “Start now” CTAs. Created from **Share link** on an audit; the share modal copies the link, turns it on/off and lists views (when, device, time on page, sections read). Prospect rows show an eye badge with the view count. Mock: the token encodes the audit path; views are stored in this browser |
| `#/ai` | **AI visibility**: how often ChatGPT, AI Overviews, Gemini, AI Mode, Perplexity and Claude name you for tracked customer questions; by-engine scores, who AI recommends instead, the sites AI answers cite (and whether you're listed), each engine's answer per question; add questions. Also a one-line summary on the Command Center and a “Do AI assistants recommend them?” section in every sales audit |
| `#/citations` | **Citations & backlinks**. Citations: health score, 18 key directories with status (correct / wrong info / missing / duplicate), rivals listed, AI-cited flag, how it's fixed (direct API, aggregator, partner submission, claim yourself) and cost; bulk “Fix & build”. Backlinks (`?tab=links`): referring domains vs. leader over time, new/lost links, link-gap opportunities (sites linking to 2+ rivals), local link ideas, outreach drafts and status |
| `#/prospects/:id` | **Sales audit** for one prospect: headline + visibility score, competitor table vs. the top 3 (gaps in red), map-pack geo-grid switchable between the prospect and the top 3 with coverage bars, Business Profile + website checklist, ordered game plan with projected rank, copyable pitch email. Prints cleanly to PDF |
| `#/todo` | Sub-page of Command Center and the only action list (the old Action plan merged in): autopilot, To do / Done / Dismissed, type chips, keyword filter, bulk apply, drawer with impact/effort/how it's applied, editable change, apply, mark done, dismiss, revert. `?task=a1` opens a task; `#/actions/:id` redirects here |
| `#/rankings` | Rankings + rank pack in one table. View switch: All results / Organic / Map pack. Filters: improved / declined / top 3, keyword search, topic tags. Each row has a mini map grid; opening it shows the full grid and competitors (tap a point, 5/7/9, now vs 30d), history, Google results. `?view=local&kw=kw_3` deep-links; `#/grid` redirects here |
| `#/competitors` → `/:id` | Benchmark table → head-to-head, category gaps, keyword overlap |
| `#/factors` | Weighted factor groups (GBP, reviews, on-page, links, citations, behavioral) with “Fix” links into To-do |
| `#/audit` → `/:id` | Health score, Core Web Vitals, issues by severity/category → diff preview, choose pages, apply via WordPress, roll back |
| `#/keywords` | Ideas / questions / competitor gap / near-me, select → track. **Generate more ideas** (toolbar, bottom of the list, or Search with a new seed) adds the next batch for the seed keyword to the current tab, marked New |
| `#/content` | **Content**: every website article and Business Profile post on one board (Ideas → Drafts → Scheduled → Published) with clicks/views, type and keyword filters, which tracked keywords have no content yet, and **Suggest ideas** (picks the least-covered, highest-volume keywords first) |
| `#/runs` | Log of every rank scan, site crawl, profile sync, competitor refresh and prospect search: status, live progress, duration, trigger, cost, failures |
| `#/profile` | GBP insights, completeness, AI review replies, post composer/scheduler |
| `#/reports`, `#/settings` | Scheduled reports + preview (headline KPIs, **keyword progress** for every tracked keyword: position bands over time, positions at four dates with change and 90-day trend, Google search / map pack switch, and **content** published and coming up); integrations, DataForSEO creds/balance, automation permissions, team, usage |

Every page has a toolbar with “Updated X ago” for its data, a live chip for any run in progress, and the page's run button (Run scan, Re-crawl site, …), which turns into “in progress” while that run is going. There's no Simple/Pro mode: every screen shows the full view.

Press `⌘K` for the command palette. Dark mode toggle is in the sidebar.

## Structure

```
src/
  components/ui.tsx      Buttons, cards, badges, deltas, tabs, drawer, modal, SVG charts
  components/Layout.tsx  Sidebar, location switcher, ⌘K, theme
  components/GridMap.tsx Geo-grid renderer (swap backdrop for MapLibre tiles)
  components/KeywordTable.tsx  Keyword + map pack table used by Command Center and Rankings
  components/Todo.tsx    To-do list, Up next strip, task drawer
  lib/tasks.ts           Unified task model + shared run state and Simple/Pro mode
  data/mock.ts           All mock data, typed
  data/prospects.ts      Prospect search, ease-of-sale scoring, quick wins, prospect geo-grid
  lib/api.ts             Endpoint map, grid coordinate math, cost estimate
  lib/tasks.ts           Unified to-do model + run state
  lib/runs.ts            Run log store (last updated, in progress)
  pages/*                One file per route
```

## Next steps toward a real build

1. Add a backend (e.g. Hono or Next.js route handlers) that holds DataForSEO Basic auth and Google OAuth tokens. Never call either API from the browser.
2. Grid scans: `gridCoordinates()` → one `serp/google/maps` task per point (`location_coordinate: "lat,lng,15z"`). Use the standard queue and a postback for cost.
3. Store scans/rankings in Postgres; compute deltas server-side.
4. Executors: GBP Business Information API (`PATCH locations/{id}?updateMask=…`), v4 reviews/localPosts, WordPress REST. Log every change with a revert payload.
