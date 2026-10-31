---
id: sales
kind: module
status: mock
agency_only: true
depends_on: []
capabilities: []
permissions: sales
code:
  - ui-mock/src/pages/Prospects.tsx
  - ui-mock/src/pages/ProspectAudit.tsx
  - ui-mock/src/pages/PublicAudit.tsx
  - ui-mock/src/data/prospects.ts
  - ui-mock/src/lib/saved.ts
  - ui-mock/src/lib/shares.ts
  - ui-mock/src/components/ProspectMap.tsx
  - ui-mock/src/components/ProspectContact.tsx
  - ui-mock/src/components/NewAudit.tsx
  - ui-mock/src/components/ShareAudit.tsx
related: [outreach, rankings, ai-answers, whitelabel, onboarding]
last_verified: 105911e
---

# Prospecting (module): prospects & audits

For agencies (Agency plan only): find local businesses to sell to, see how easy each would be to win, audit them, and share a branded audit link. Pages: `/prospects`, `/prospects/:id` (sales audit), `/a/:token` (public shared audit).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Search a keyword or Google category around a city, ZIP or lat/lng | **stub** |
| **Bulk**: paste keywords × places, run every combination, each saved | **stub** |
| One results table, one summary line (search, found, easy, reachable owners, missed revenue) with Pin and Refresh | `mock` |
| Sortable columns: business, ease of sale (score with Easy / Medium / Hard), map rank, rating, contact quality, missing $/mo, distance, outreach status; top row tagged **Easiest sale** | `mock` |
| Filters, presets, **Not contacted yet**; sticky toolbar quick-select (All / Easy / Verified email / Not contacted) | `mock` |
| Selection: export (with audit links), add to pipeline, **Send to campaign** | `mock` |
| Row: map thumbnail, outreach column (lead status, audit views), one-click send, Audit; expands into map vs the top 3, quickest fixes, contact card | `mock` |
| Keyboard: j/k move, x select, Enter expand, a audit, s send | `mock` |
| **Saved searches & audits**: every search and direct audit saved; filter, pin; reopening is free; returning reopens the last search | `mock` (browser) |
| **Only businesses with no website** | **stub** |
| **Audit a business** directly (name or Maps link + city → pick listing → keyword) | **stub** |
| **Sales audit**: headline + visibility score, competitor table vs top 3 (gaps in red), geo-grid switchable between prospect and top 3 with coverage bars, Business Profile + website checklist, "Do AI assistants recommend them?", ordered game plan with projected rank, copyable pitch email; prints to PDF | `mock` |
| **Share link**: public audit written to "you", no contact details or pitch, "Book a 15-min walkthrough" and "Start now" CTAs; turn on/off; views (when, device, time on page, sections read); eye badge with view count on rows | **stub**: token encodes the path; views in this browser |

## How it connects

Feeds Outreach (send to campaign). Uses whitelabel on shared audits. Off: all prospecting pages hide. Only visible when `member.plan === "agency"`.
