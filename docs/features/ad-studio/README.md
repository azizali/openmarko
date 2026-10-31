---
id: ad_studio
kind: feature
module: ads
status: mock
depends_on: [ads]
capabilities: [creatives.render, creatives.design, ads.publish]
permissions: ad_studio
code:
  - ui-mock/src/pages/AdStudio.tsx
  - ui-mock/src/lib/creatives.ts
  - ui-mock/src/lib/ads.ts
related: [ads, ad-research, brand-skills, automation]
last_verified: 105911e
---

# Creative studio

Make ad creatives in bulk from a brief, check them, approve the good ones and publish them as tests. Page: `/ads/studio`.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| **Brief**: reference ads from the swipe file, offer, landing page, angles, hooks per angle, formats (image, carousel, short video, Google search ad), sizes (1:1, 4:5, 9:16, 1.91:1), looks; Before/after off when a brand rule forbids it | `mock` |
| Shows count, file count and render cost before generating | `mock` |
| One batch = angles × hooks × formats, every size | **stub**: copy from a copy bank |
| Results list: thumbnail, angle, format, **score** (how that angle/format did in your account and how long similar ads run nearby), **checks** (Meta's rule against implying a health condition, Google's 30-character headlines, text folding after 125 characters, brand rules), status | `mock` |
| Approve / reject per row or selection, **Approve 75+ that pass**, **More like these** | `mock` |
| Open a row: every size, edit copy (Shorter, Punchier, More local, button), what it learned from | `mock` |
| **Publish** approved creatives to a platform (only formats it takes) as a new test campaign or into an existing one: ad set per angle or all in one, daily budget per ad set, Locations, start paused; warns when over the cap | **stub** |
| Batches list beside the brief | `mock` |
| Autopilot: "Launch new ads from approved creatives" (default Ask first) | `mock` |

## How it connects

Fed by Ad research and Campaigns (references); publishes to Campaigns. Off: "Make creatives", "Make variations" and "Make my versions" leave Campaigns and Ad research; fresh-version recommendations are left out.
