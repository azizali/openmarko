---
id: social
kind: module
status: mock
depends_on: []
capabilities: [social.insights]
permissions: social
code:
  - ui-mock/src/data/social.ts
  - ui-mock/src/components/Social.tsx
  - ui-mock/src/components/PostPreview.tsx
  - ui-mock/src/components/CommandTop.tsx
related: [social-scanner, social-swipe, social-posts, brand-skills, home-reports]
last_verified: 105911e
---

# Social media (module)

Find what's working, save ideas, write posts in the brand voice, and plan and publish them to the Organization's Accounts. There's no separate overview page: `/social` redirects to the Social scanner, and the module's summary lives on Home ("Social this week" and the social row of the Presence score).

**Status: `mock`.**

## Features in this module

| Feature | Doc | Needs a connected Account? |
|---|---|---|
| Social scanner (Reply, Trending, Watching) | [social-scanner](../social-scanner/) | No |
| Swipe file | [social-swipe](../social-swipe/) | No |
| Posts & calendar | [social-posts](../social-posts/) | Yes |

## Shared pieces

- **Post drawer** (`components/Social.tsx`): one drawer to remix a trend, write from a swipe, or edit any post. Pick channels, adjust (Shorter, More playful, More expert), edit each channel's text, see the shot list and best time per channel, then Save draft, Post now or Schedule.
- **Live preview** (`components/PostPreview.tsx`): how the post looks on Instagram, TikTok, X, LinkedIn, Facebook or the Google Business Profile: where the text folds into "… more", hashtags, media crop, X's 280-character limit, the Google button.
- **Accounts** (GLOSSARY): the Organization's profiles on each Platform; speaks for the whole Organization unless tagged to one Location. A Google Business Profile counts as an Account.

## How it connects

- **Feeds:** Home (social this week, Presence score social row), the assistant ("What's trending?", "Make a TikTok in my voice").
- **Turned off:** every social page hides; Home leaves out the social summary.
