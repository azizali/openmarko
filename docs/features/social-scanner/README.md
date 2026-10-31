---
id: social_scanner
kind: feature
module: social
status: mock
depends_on: [social]
capabilities: []
permissions: social_scanner
code:
  - ui-mock/src/pages/SocialScanner.tsx
  - ui-mock/src/data/scanner.ts
  - ui-mock/src/lib/scanner.ts
  - ui-mock/src/data/watch.ts
  - ui-mock/src/lib/watch.ts
  - ui-mock/src/data/social.ts
related: [social-swipe, social-posts, brand-skills, onboarding, automation]
last_verified: 105911e
---

# Social scanner

Finds conversations to join, trends to make your own, and standout posts from watched profiles. Page: `/social/scanner` with tabs Reply, Trending (`?tab=trending`; `?tab=remix` and `/social/trends` still work) and Watching (`?tab=watching`).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| **Settings drawer** (also the status line under the title): Reply side (sources, places to watch per source, listening terms grouped Services / Your name / Competitors / Other, scan frequency, max post age, mention alerts) and Trending side (trend sources, topics, area and reach, never suggest, minimum fit slider, frequency) | `mock` |
| Sources: Reddit, Quora, Facebook groups, X, Nextdoor; add Instagram, TikTok, LinkedIn or YouTube comments; Connect those that need an account | `mock` |
| **Reply**: people asking for the service, questions you can answer, mentions; best fit first; platform filter | `mock` |
| Open a conversation: the post, why to reply, a reply drafted with the locked **Community replies** skill (editable), the community's rules; **Copy reply & open**, **Mark replied**, **Not for us**, undo | `mock` (replying always happens on the platform, by a person) |
| **Trending**: what's catching on this week, source, velocity, fit, why it works, your version; **Save to swipe file**; **Remix in my voice** (post drawer) | `mock` |
| **Watching**: posts by watched profiles (competitors / inspiration) that beat their own usual views; Remix, Save; list of who you watch with add/remove | `mock` |

## How it connects

- **Needs:** nothing.
- **Feeds:** Swipe file, Posts & calendar, Home ("conversations to join", best trend, top watched post), To-do, the assistant.
- **Turned off:** `/social/scanner` hides.
