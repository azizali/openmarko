---
id: social_posts
kind: feature
module: social
status: mock
depends_on: [social]
connection: social_accounts
capabilities: [social.publish, social.insights, profile.posts]
permissions: social_posts
code:
  - ui-mock/src/pages/SocialPosts.tsx
  - ui-mock/src/lib/social.ts
  - ui-mock/src/components/Social.tsx
  - ui-mock/src/components/PostPreview.tsx
related: [social, social-scanner, social-swipe, seo, automation, brand-skills]
last_verified: 105911e
---

# Posts & calendar

The one place for posts, Google Business Profile posts included. Page: `/social/posts`.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Followers, views and reactions, each broken down by platform, with where the numbers come from and which accounts aren't connected | `mock` |
| Next 7 days with scheduled posts and dashed drafts | `mock` |
| Scheduled / Drafts / Published lists (published with views and reactions) | `mock` |
| Any post opens the post drawer: edit, schedule, unschedule, post now, delete | `mock` |
| **New post** | `mock` |
| Post to Instagram, Facebook, TikTok, X, LinkedIn, Google Business Profile | **stub** |
| Autopilot: "Fill empty calendar slots and publish" (default Ask first); Business Profile posts (default On its own) | `mock` |

## How it connects

- **Needs:** at least one connected Account (a Google Business Profile counts).
- **Fed by:** Social scanner, Swipe file, the assistant.
- **Feeds:** Home (next post, how often posts were seen), Presence score.
- **Turned off:** `/social/posts` hides.
