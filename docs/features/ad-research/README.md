---
id: ad_research
kind: feature
module: ads
status: mock
depends_on: [ads]
capabilities: [ads.library]
permissions: ad_research
code:
  - ui-mock/src/pages/AdResearch.tsx
  - ui-mock/src/lib/creatives.ts
  - ui-mock/src/data/ads.ts
related: [ads, ad-studio, automation]
last_verified: 105911e
---

# Ad research & swipe file

Search other advertisers' ads and keep the ones worth learning from. Pages: `/ads/research` and the **Ad swipe file** tab (`?tab=swipe`).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Search by advertiser, keyword or service and place across Meta, Google and TikTok ad libraries | **stub** |
| **What's working**: reads ads that kept running 30+ days: common angles, offers that keep running, formats, competitors bidding on your name, angles nobody uses | `mock` |
| Sortable table (ad, angle, format, days running with **Long runner** tag, live versions, offer); 30+ days and format filters | `mock` |
| Open an ad: full ad, why it works, how your version could sound | `mock` |
| Watched competitors show ads started in the last two weeks | `mock` |
| **Save to swipe file**, **Make my versions** (opens Creative studio with references) | `mock` |
| **Ad swipe file**: saved from research, your own ads from Campaigns, or **Add an ad** with a link; angle, format, run length, why it works, your version, note; filter by source and angle | `mock` |
| Competitor ad check (Schedules, daily) | **stub** |

## How it connects

Feeds Creative studio. Off: `/ads/research` hides; "Make my versions" depends on Creative studio being on.
