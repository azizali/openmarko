---
id: content
kind: feature
module: seo
status: mock
depends_on: [seo]
capabilities: [site.write, search.read, analytics.read]
permissions: content
code:
  - ui-mock/src/pages/Content.tsx
  - ui-mock/src/lib/content.ts
related: [rankings, brand-skills, automation, home-reports, social-posts]
last_verified: 105911e
---

# Articles

Website articles from idea to published, drafted by the assistant with the `blog-article` skill. Page: `/content`. Google profile posts and social posts are in [social-posts](../social-posts/), not here.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Board per Website: Ideas → Drafts → Scheduled → Published, with clicks | `mock` |
| Keyword filter; which tracked keywords have no article yet | `mock` |
| **Suggest ideas**: least-covered, highest-volume keywords first | `mock` |
| Assistant drafts articles | **stub** |
| Publish to the website (WordPress) | **stub** |
| Autopilot: "Publish articles to your site" (default Ask first) | `mock` |

## How it connects

- **Needs:** a Website for the scoped Location; WordPress connected to publish.
- **Feeds:** Reports (content published and coming up), Rankings (keyword coverage).
- **Turned off:** `/content` hides.
