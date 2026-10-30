# Groundwork: local SEO (mock scaffold)

Clickable mock of a local rank-tracking tool that tracks your Google Business Profile, benchmarks competitors, suggests improvements and applies them. All data is mock (`src/data/mock.ts`). The intended DataForSEO and Google endpoints are listed in `src/lib/api.ts`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Routes

Every page is one click from the sidebar, grouped by kind of marketing: **Home**, **To-do** and **Reports** at the top; **SEO**: Rankings (Keywords & map pack, Competitors, AI answers, Ranking factors, Keyword ideas), Reviews & content (Reviews, Articles, Business Profile), Citations & backlinks (Citations, Backlinks), Site health; **Social**: Trending ideas, Posts & calendar; **Sales**: Prospecting (Agency plan only, `workspace.plan` in `data/mock.ts`); **Marko**: Brand voice, Skills. Then Activity (the run log), Settings and the dark mode switch. Groups list their pages as sub-items: the group holding the current page is open, others open with their chevron. Sub-items deep-link with `?tab=` (`#/profile?tab=reviews`, `#/citations?tab=links`). The location switcher only shows with more than one location.

| Route | What it shows |
| --- | --- |
| `#/onboarding` | Find business → connect GBP / Search Console / GA4 (mock OAuth + property picker) → pick keywords → competitors → grid size/radius/cost → first-scan progress |
| `#/` | **Home** is Marko's weekly brief: a greeting, the 28-day summary card and Local presence score (each row links to its page), what Marko already did (“While you were away”), the **3 things that need you this week** with their action buttons, and a reply box. Replying opens the conversation in the ⌘J panel. |
| `#/prospects` | **Prospecting**: search keyword + city, every business in the map pack scored by ease of sale (rank 4–15, quick fixes under an hour, good rating, no agency, runs ads). Every row has a map thumbnail and expands into that business's map vs. the top 3 (switch in place). Top pick card shows its map beside the leader's. Searches are logged as runs. Filters (low-hanging fruit, no website, unclaimed, no agency), sort by ease / value / rank |
| `#/prospects` (saved, no-website, direct audit) | **Saved searches & audits**: every search and direct audit is saved (localStorage in the mock) and listed above the search; reopening one is free, a banner shows when it was fetched with a Refresh button, pin or remove entries, and coming back to Prospecting reopens your last search. **No website only** toggle: DataForSEO Business Listings search with filter `["url", "=", null]`, plus the top 3 for comparison. **Audit a business** (also in ⌘K, or `?new=audit`): name or Google Maps link + city → pick the right listing → keyword → audit, no prospecting search needed |
| `#/a/:token` | **Shared audit link** (public, no app chrome): the sales audit written to “you”, without contact details or the pitch, with “Book a 15-min walkthrough” and “Start now” CTAs. Created from **Share link** on an audit; the share modal copies the link, turns it on/off and lists views (when, device, time on page, sections read). Prospect rows show an eye badge with the view count. Mock: the token encodes the audit path; views are stored in this browser |
| `#/social/trends` | **Trending ideas**: what's catching on in the niche and the city this week (formats, topics, local threads, seasonal moments), each with its source, velocity, a fit score, **why it works** and **your version**. **Remix in my voice** opens a drawer: pick channels (unconnected ones link to Settings), adjust (Shorter, More playful, More expert; channels you typed into are left alone), edit each channel's text, see the shot list and the best time per channel, then Save draft, Post now or Schedule. Beside the editor, a **live preview** shows the post as it will look on the selected platform (Instagram, TikTok, X, LinkedIn, Facebook, Google profile): where the text folds into "… more", hashtags, the media crop, X's 280-character limit and the Google button |
| `#/social/posts` | **Posts & calendar**: the one place for posts, Google profile posts included. Followers, views and reactions; the next 7 days with scheduled posts and dashed drafts; Scheduled / Drafts / Published lists (published with views and reactions). Any post opens the same drawer to edit, schedule, unschedule, post now or delete. **New post** starts a blank one |
| `#/brand` | **Brand voice**: the business's brand profile, shared by every location and used in everything Marko writes (review replies, Google and social posts, articles, emails and reports). The voice in a sentence (learned from past posts, review replies and the website), tone sliders, words to say and never say, examples that do and don't sound like you, **business facts** (services, what makes you different, current offers, rules Marko always follows, such as never confirming someone is a patient), and **Try it**: paste text and see it rewritten. `#/social/voice` redirects here |
| `#/skills` | **Skills**: what Marko knows how to write, one skill per kind of writing (Viral social posts, Trend remix, Google profile posts, Website articles, Review replies, Report summaries). Each has when Marko uses it, editable instructions, the background information it loads (brand voice always; business facts, trends, rankings, reviews or results as needed) and an example. Turn a skill off and Marko won't write with it; **New skill** adds your own. Marko's answers say which skill they used |
| `#/ai` | **AI visibility**: how often ChatGPT, AI Overviews, Gemini, AI Mode, Perplexity and Claude name you for tracked customer questions; by-engine scores, who AI recommends instead, the sites AI answers cite (and whether you're listed), each engine's answer per question; add questions. Also a row in the home scorecard and a “Do AI assistants recommend them?” section in every sales audit |
| `#/citations` | **Citations & backlinks**. Citations: health score, 18 key directories with status (correct / wrong info / missing / duplicate), rivals listed, AI-cited flag, how it's fixed (direct API, aggregator, partner submission, claim yourself) and cost; bulk “Fix & build”. Backlinks (`?tab=links`): referring domains vs. leader over time, new/lost links, link-gap opportunities (sites linking to 2+ rivals), local link ideas, outreach drafts and status |
| `#/prospects/:id` | **Sales audit** for one prospect: headline + visibility score, competitor table vs. the top 3 (gaps in red), map-pack geo-grid switchable between the prospect and the top 3 with coverage bars, Business Profile + website checklist, ordered game plan with projected rank, copyable pitch email. Prints cleanly to PDF |
| `#/todo` | The only action list (the old Action plan merged in): autopilot, To do / Done / Dismissed, type chips, keyword filter, bulk apply, drawer with impact/effort/how it's applied, editable change, apply, mark done, dismiss, revert. `?task=a1` opens a task; `#/actions/:id` redirects here |
| `#/rankings` | Rankings + rank pack in one table. View switch: All results / Organic / Map pack. Filters: improved / declined / top 3, keyword search, topic tags. Each row has a mini map grid; opening it shows the full grid and competitors (tap a point, 5/7/9, now vs 30d), history, Google results. `?view=local&kw=kw_3` deep-links; `#/grid` redirects here |
| `#/competitors` → `/:id` | Benchmark table → head-to-head, category gaps, keyword overlap |
| `#/factors` | Weighted factor groups (GBP, reviews, on-page, links, citations, behavioral) with “Fix” links into To-do |
| `#/audit` → `/:id` | Health score, Core Web Vitals, issues by severity/category → diff preview, choose pages, apply via WordPress, roll back |
| `#/keywords` | Ideas / questions / competitor gap / near-me, select → track. **Generate more ideas** (toolbar, bottom of the list, or Search with a new seed) adds the next batch for the seed keyword to the current tab, marked New |
| `#/content` | **Articles**: every website article on one board (Ideas → Drafts → Scheduled → Published) with clicks, keyword filter, which tracked keywords have no article yet, and **Suggest ideas** (least-covered, highest-volume keywords first). Google profile and social posts live in Posts & calendar |
| `#/runs` | Log of every rank scan, site crawl, profile sync, competitor refresh and prospect search: status, live progress, duration, trigger, cost, failures |
| `#/profile` | GBP insights, completeness, AI review replies (`?tab=reviews`). Profile posts are in Posts & calendar |
| `#/reports`, `#/settings` | Scheduled reports + preview (headline KPIs, **keyword progress** for every tracked keyword: position bands over time, positions at four dates with change and 90-day trend, Google search / map pack switch, and **content** published and coming up); integrations, DataForSEO creds/balance, automation permissions, team, usage |

Every page has a toolbar with “Updated X ago” for its data, a live chip for any run in progress, and the page's run button (Run scan, Re-crawl site, …), which turns into “in progress” while that run is going. There's no Simple/Pro mode: every screen shows the full view.

**Marko, the assistant.** `⌘J`, **Ask Marko** in the sidebar, or the floating logo button (bottom right; drag it anywhere, and it stays where you drop it) opens a panel docked beside any page. The clock icon in the panel lists every chat, newest first, with the page it started on and the last answer; open one to carry on, or delete it. Chats are saved in this browser (`gw-marko-chats`), and a first visit starts with three example chats. It knows the page you're on (“Looking at: Reviews”, plus the open keyword on Rankings) and suggests questions for it. Answers mix text with blocks: task rows with the same Apply/Undo buttons as To-do, a now-vs-30-days map, stat tiles and links. The panel widens when an answer has a map. “Do all”, “Fix them”, “Publish both” and “Reply to all” apply the tasks from the last answer (tasks that need a person get listed with steps instead). Marko also handles social: “What's trending this week?”, “Make a TikTok in my voice”, “Write an Instagram post about the time change” (drafts a post from the best-matching trend, shown with a tab per channel), then “Make it shorter” / “more playful” and “Schedule it”. In `⌘K`, anything typed can be sent to Marko; that row comes first when nothing else matches or the text reads like a sentence. Mock: `lib/assistant.ts` matches intents against the mock data. Real build: a backend route calls Claude with tools mapped to the same executors and streams the same blocks back, and Settings → Automation decides what it may change without a click.

Press `⌘K` for the command palette; it reaches every page. Dark mode is at the bottom of the sidebar (top bar on phones). There is one color theme.

## Structure

```
src/
  components/ui.tsx      Buttons, cards, badges, deltas, tabs, drawer, modal, SVG charts
  components/Layout.tsx  Sidebar, section tabs, location switcher, ⌘K
  components/GridMap.tsx Geo-grid renderer (swap backdrop for MapLibre tiles)
  components/KeywordTable.tsx  Keyword + map pack table used by Rankings
  components/Todo.tsx    To-do list, This week list, task drawer
  components/Assistant.tsx  Marko panel, answer blocks, composer
  lib/tasks.ts           Unified task model + shared run state
  lib/theme.ts           Dark mode (applied before first render)
  lib/assistant.ts       Marko conversation store and mock intent matching
  lib/social.ts          Social post store (draft → scheduled → published)
  components/Social.tsx  Channel badge and the post drawer (remix / edit)
  components/PostPreview.tsx  How a post looks on each platform
  lib/skills.ts          Skill on/off, edits and custom skills
  data/mock.ts           All mock data, typed
  data/social.ts         Channels, trending ideas and the per-channel remix writer
  data/brand.ts          Brand profile: voice and business facts, background for every skill
  data/skills.ts         Marko's writing skills (instructions, background, example)
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
