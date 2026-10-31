---
id: reviews
kind: feature
module: seo
status: mock
depends_on: [seo]
capabilities: [reviews.read, reviews.reply]
permissions: reviews
code:
  - ui-mock/src/pages/Profile.tsx
  - ui-mock/src/lib/tasks.ts
  - ui-mock/src/data/skills.ts
related: [seo, automation, brand-skills, marko, workflows]
last_verified: 105911e
---

# Reviews

Read and reply to Google reviews for each Location, with replies drafted in the brand voice by the locked **Review replies** skill. Lives on Business Profile → Reviews (`/profile?tab=reviews`).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Review list per Location with filters | `mock` |
| Assistant-drafted replies in the brand voice, never confirming someone is a patient | **stub**: canned drafts |
| Edit, approve and post replies | **stub**: nothing posts to Google |
| Autopilot: 4–5★ replies can be "On its own"; 1–3★ never above "Ask first" | `mock` |
| Review requests sent from Workflows (Review request recipe) | `mock` |
| "Reply to all" from the assistant | `mock` |

## How it connects

- **Needs:** the Location's Google profile.
- **Feeds:** To-do (review reply tasks), Home, Reports, Ranking factors (reviews group).
- **Turned off:** the Reviews tab leaves Business Profile.
