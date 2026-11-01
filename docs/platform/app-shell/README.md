---
id: app-shell
kind: platform
status: mock
depends_on: [feature-switches, access-roles, organizations-partners]
capabilities: []
permissions: none of its own
code:
  - ui-mock/src/App.tsx
  - ui-mock/src/components/Layout.tsx
  - ui-mock/src/components/Scope.tsx
  - ui-mock/src/components/Needs.tsx
  - ui-mock/src/components/RunStatus.tsx
  - ui-mock/src/components/ui.tsx
  - ui-mock/src/lib/scope.ts
  - ui-mock/src/lib/setup.ts
  - ui-mock/src/lib/theme.ts
  - ui-mock/src/pages/Settings.tsx
related: [feature-switches, access-roles, automation, marko]
last_verified: 105911e
---

# App shell & scope

The frame every page sits in: sidebar navigation, the Organization and Scope switcher, the ⌘K command palette, the Settings layout, the per-page toolbar, the "Connect" fallback when something isn't set up, dark mode, and the person's own settings (Profile, Appearance, Notifications, Plan & billing).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Sidebar grouped by kind of marketing (Home, To-do, Reports; SEO; Social; Ads; Customers; Sales; Assistant), groups expand to sub-items, deep links with `?tab=` | `mock` |
| Organization switcher + Scope (all Locations or one) | `mock` |
| Scope bar under each page title switches Location in place (hidden with one Location and one Website) | `mock` |
| "All locations" shows a comparison table, one row per Location or Website, with Open | `mock` |
| ⌘K command palette: every page, Settings sections, actions like "Audit a business"; anything typed can go to the assistant | `mock` |
| Pages and Settings sections filtered by feature switches and role | `mock` |
| Per-page toolbar: "Updated X ago", live chip for a run in progress, the page's run button | `mock` |
| **Nothing is required**: a page missing a Location, Google Business Profile, Website or Account shows **Connect** instead of its tools; everything else keeps working | `mock` |
| Website addresses open in a new tab (`ExternalUrl`) | `mock` |
| Old routes redirect (`/grid`, `/actions/:id`, `/automations`, `/brand`, `/skills`, `/runs`, `/social/voice`…) | `mock` |
| Dark mode (sidebar toggle and Settings → Appearance) | `mock`, saved in browser |
| You settings: Profile, Appearance, Notifications (weekly digest, ranking drops, new reviews, waiting for you, product updates), Plan & billing | **stub** except Appearance |
| Responsive: section tabs become a scrolling strip; top bar on phones | `mock` |

## What each page needs (`lib/setup.ts`)

| Needs | Pages |
|---|---|
| A Location (name + address) | Rankings, Competitors, Citations, AI answers |
| That Location's Google Business Profile | Business Profile, Reviews, Google posts, calls & directions |
| A Website for that Location | Site health, Articles, Backlinks |
| At least one connected Account | Posts & calendar |
| Nothing | Social scanner, Trending, Swipe file |
