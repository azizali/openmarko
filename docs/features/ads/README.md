---
id: ads
kind: module
status: mock
depends_on: []
connection: ad_account
capabilities: [ads.read, ads.publish, ads.conversions, calls.track, bookings.read, analytics.read]
permissions: ads
code:
  - ui-mock/src/pages/Ads.tsx
  - ui-mock/src/components/Ads.tsx
  - ui-mock/src/lib/ads.ts
  - ui-mock/src/data/ads.ts
related: [ad-research, ad-studio, customers, automation, integrations]
last_verified: 105911e
---

# Ads (module) and Campaigns

Run Meta, Google and TikTok ads against one goal: a cost per booked patient (or lead, or 60s+ call) and a monthly cap. The module's page is **Campaigns** (`/ads`). The assistant reviews results on a schedule, recommends changes with the numbers behind them, and either waits for approval or applies the safe ones within guardrails.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| **Goal**: result type (booked appointment, form lead, 60s+ call), target cost per result, monthly cap | `mock` |
| Goal card: this week's cost per result vs target, results, spend, daily budgets vs cap, next review, weekly trend | `mock` |
| **Recommendations** with numbers and expected effect: pause an ad that spent 2× target without beating 1.5× (when better ads exist), cut a campaign over target, block Google search terms that spent and never booked, raise a winner by the guardrail step (within the cap), flag tired ads (frequency 3.5+, click rate down 25%+) or studio test winners | `mock` |
| Apply one, dismiss, or apply all budget and pause changes | `mock` |
| **Review now** or on schedule; **Auto within guardrails** mode applies safe changes | **stub**: simulates the days since the last review |
| **Guardrails**: review cadence (daily / every 3 days / weekly), mode, biggest budget step, spend before judging an ad, whether new ads may launch without asking | `mock` |
| **Performance, 7 days**: sortable table at Campaign / Ad set / Ad level, platform and verdict filters (Losing, Wearing out, Learning, On target, Winning, Paused), on/off per row, inline budgets, cost per result coloured against target, frequency and click-rate trend | `mock` |
| Bulk: pause, turn on, save to ad swipe file, make variations | `mock` |
| **Changes** log: by you or the assistant, what happened after, Undo | `mock` |
| "Make fresh versions" / "Make more like it" open Creative studio with that ad as reference | `mock` |

## How it connects

- **Needs:** an ad account (Meta, Google or TikTok). Ad tracking (Pixel/CAPI, Google conversions, CallRail, booking system) makes "result" a booking, not a click.
- **Feeds / fed by:** Creative studio (publish, refresh), Ad research (saved own winners), Contacts (ad leads, bookings reported back as conversions), Autopilot (`ads_safe`, `ads_launch`), Schedules (`ads_review`).
- **Turned off:** all Ads pages hide.
