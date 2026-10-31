---
id: social_swipe
kind: feature
module: social
status: mock
depends_on: [social]
capabilities: []
permissions: social_swipe
code:
  - ui-mock/src/pages/SwipeFile.tsx
  - ui-mock/src/lib/swipes.ts
related: [social-scanner, social-posts, brand-skills]
last_verified: 105911e
---

# Swipe file

The Organization's library of post formats and ideas worth reusing. Page: `/social/swipe`. (The ads swipe file is separate: [ad-research](../ad-research/).)

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Vertical list, each with its beats in order | `mock` |
| Sources: saved from trends, written by you, starters (Myth vs. fact, 3 questions before you book, Meet the team Monday, The price upfront, Answer a real question) | `mock` |
| **New idea**: name, kind, why it works, beats, your version, best channels | `mock` |
| Filter by source | `mock` |
| **Create post** opens the post drawer to write it in your voice per channel | `mock` |

## How it connects

Fed by the Social scanner (Save to swipe file); feeds Posts & calendar and Autopilot's "Fill empty calendar slots". Off: `/social/swipe` hides.
