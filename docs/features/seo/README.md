---
id: seo
kind: module
status: mock
depends_on: []
capabilities: [profile.edit, profile.posts, profile.insights]
permissions: seo
code:
  - ui-mock/src/pages/Profile.tsx
  - ui-mock/src/data/mock.ts
  - ui-mock/src/data/scoped.ts
  - ui-mock/src/lib/api.ts
related: [rankings, ai-answers, reviews, content, citations, site-health, social-posts]
last_verified: 105911e
---

# Local SEO (module) and Business Profile

The Local SEO module groups everything about being found in search: map pack and organic rankings, AI answers, reviews, articles, citations and backlinks, and site health. The module's own page is **Business Profile** (`/profile`): the Google Business Profile for the scoped Location.

**Status: `mock`.**

## Who uses it

Business owners and marketers who want more calls and direction requests from Google; agencies running local SEO for clients.

## What it can do (Business Profile)

| Capability | State |
|---|---|
| Profile insights (calls, directions, searches, last 90 days) | `mock` |
| Profile completeness with what's missing | `mock` |
| Reviews tab (`?tab=reviews`), see [reviews](../reviews/) | `mock` |
| Edit details (hours, categories, services, description) as To-do tasks | **stub** |
| Google posts | live in [social-posts](../social-posts/) (Posts & calendar) |
| One Location at a time; "All locations" shows a comparison table | `mock` |

## Features in this module

| Feature | Doc |
|---|---|
| Rankings & competitors | [rankings](../rankings/) |
| AI answers | [ai-answers](../ai-answers/) |
| Reviews | [reviews](../reviews/) |
| Articles | [content](../content/) |
| Citations & backlinks | [citations](../citations/) |
| Site health | [site-health](../site-health/) |

## How it connects

- **Needs:** a Location for public-data pages; that Location's Google Business Profile for Business Profile, Reviews, Google posts and insights ([app-shell](../../platform/app-shell/) § Needs).
- **Feeds:** Home's search numbers and Presence score, Reports, the sales audit's methodology, the assistant's SEO answers.
- **Turned off:** every SEO page hides; Home leaves out search numbers.
