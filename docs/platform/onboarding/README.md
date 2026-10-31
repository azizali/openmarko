---
id: onboarding
kind: platform
status: mock
depends_on: [organizations-partners, integrations, brand-skills]
capabilities: [profile.edit, search.read, analytics.read, social.publish]
permissions: setup.connect
code:
  - ui-mock/src/pages/Onboarding.tsx
  - ui-mock/src/lib/watch.ts
related: [organizations-partners, integrations, brand-skills, rankings, social-scanner]
last_verified: 105911e
---

# Onboarding: Add an organization

A guided setup that turns a website or business name into a ready Organization. Reached from **Add organization** in the switcher or ⌘K (`/onboarding`, outside the app frame).

**Status: `mock`.** Every step is clickable; discovery returns Maple & Main's data.

## Steps

1. **Enter** a website or business name.
2. **Reading**: the app reads the website, Google profiles, social links, reviews and nearby searches.
3. **What we found**: name and category, Locations (each with a Google profile), Websites and which Location each serves, social Accounts linked from them, each with "Speaks for".
4. **Connect**: Google (Business Profile, Search Console, Analytics; pick every property) and social sign-ins (Meta covers Instagram and Facebook). Every connection can be skipped.
5. **Brand voice** drafted from the sites and review replies.
6. **What to track**, all pre-ticked, each list with an add row: keywords and competitors per Location, profiles to watch (competitors' accounts found on their sites, plus any), map-scan grid and frequency, where the social scanner looks and what it listens for, Trending topics.
7. **Launch**: the new name is added to the switcher.

## What's stubbed

Discovery, Google and social sign-ins, and the drafted voice are all canned. The new Organization has no data of its own (shows Maple & Main's).
