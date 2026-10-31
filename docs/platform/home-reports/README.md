---
id: home-reports
kind: platform
status: mock
depends_on: []
capabilities: [search.read, analytics.read, profile.insights, social.insights]
permissions: none (open to every Member); report content follows feature switches
code:
  - ui-mock/src/pages/CommandCenter.tsx
  - ui-mock/src/components/CommandTop.tsx
  - ui-mock/src/pages/Reports.tsx
related: [automation, marko, seo, social, rankings, content]
last_verified: 105911e
---

# Home & reports

**Home** is the assistant's weekly brief. **Reports** are scheduled client-ready reports with a live preview.

**Status: `mock`.**

## Home (`/`)

- 28-day summary: calls from Google, map pack, AI answers, how often posts were seen.
- **Presence score** with a row each for map pack, Google, AI answers, website, reviews and social (social only with a connected Account).
- **Social this week**: next post going out (or connect an account), conversations to join, best-fitting trend, top post from watched profiles.
- "While you were away" (including the week's best post), the 3 things for this week (from To-do), and a reply box to the assistant with suggestions.
- Blocks drop out when their feature is off (search numbers without SEO, social summary without Social, reply box without the assistant).

## Reports (`/reports`)

- Scheduled reports (e.g. "Monthly client report") with recipients and cadence; **New report**.
- Preview "What your client sees": executive summary, keyword progress & map pack (position bands over time, positions at four dates with change and 90-day trend, Google search / map pack switch), rankings & changes, competitor movement, content published & planned, Business Profile insights, site audit, actions completed, Search Console & GA4 traffic, share of local voice.
- PDF button per report.
- Whitelabelled ("Prepared by" the Partner).

| Capability | State |
|---|---|
| Home brief and Presence score | `mock` (mock numbers) |
| Report preview | `mock` |
| Scheduled report emails | **stub**: nothing sends |
| PDF | **stub**: the button only shows a "Generating PDF…" toast |
