---
id: brand-skills
kind: platform
status: mock
depends_on: []
capabilities: []
permissions: brand
code:
  - ui-mock/src/data/brand.ts
  - ui-mock/src/pages/Brand.tsx
  - ui-mock/src/data/skills.ts
  - ui-mock/src/lib/skills.ts
  - ui-mock/src/pages/Skills.tsx
related: [marko, reviews, content, social-posts, social-scanner, ad-studio, campaigns, inbox, outreach, home-reports]
last_verified: 105911e
---

# Brand voice & skills

**Brand voice** is how the Organization sounds, shared by every Location and Account. **Business facts** are what the assistant may say about it (services, offers, hours, rules it always follows). **Skills** are instructions for one kind of writing (review replies, viral posts, articles…) applied on top of the brand voice. Everything the assistant writes goes through the brand voice plus one skill. See [GLOSSARY.md](../../../GLOSSARY.md).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Brand voice in a sentence, "learned from" past posts, review replies and website | **stub**: static mock profile |
| Tone sliders, words to say / never say, examples that do and don't sound like you | `mock` |
| Business facts: services, differentiators, offers, rules (e.g. never confirm someone is a patient) | `mock` |
| **Try it**: paste text, see it in your voice | **stub**: canned rewrite |
| Skills list: Built-in / Public / Custom tabs | `mock` |
| Each skill is a SKILL.md (frontmatter `name`, `description`, `background` + markdown body) | `mock`, parser real |
| Edit SKILL.md with Edit / Preview, live frontmatter errors, Download; edited built-ins show **Edited** and can be reset | `mock` |
| **Locked** skills (Review replies, Community replies) carry privacy/platform rules: on/off only | `mock` |
| Browse public skills (verified publisher flag), add a copy pinned to its version | **stub**: `publicSkills` stands in for the index |
| Upload .md, New skill | `mock` |
| Turn a skill off and the assistant won't write with it; answers say which skill they used | `mock` |

## Skills in the mock

Built-in: `social-viral`, `trend-remix`, `community-reply` (locked), `gbp-post`, `blog-article`, `review-reply` (locked), `report-summary`. Public index: `email-newsletter`, `sms-promo`, `case-study`, `instagram-carousel`, `hiring-post`, `google-ads-copy`, `youtube-shorts`.

## How it connects

Used by [marko](../../features/marko/), [reviews](../../features/reviews/), [content](../../features/content/), [social-posts](../../features/social-posts/), [social-scanner](../../features/social-scanner/) (replies and remixes), [ad-studio](../../features/ad-studio/), [campaigns](../../features/campaigns/), [inbox](../../features/inbox/), [outreach](../../features/outreach/) and [home-reports](../home-reports/). Onboarding drafts the brand voice.
