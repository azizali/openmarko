---
id: seo
kind: feature
module: seo
status: built (stub data until live keys are connected)
depends_on: [automation, integrations, features]
capabilities: [search.maps, search.organic, search.ai, search.keywords, places.find, profile.manage]
permissions: seo
code: [modules/seo, apps/web/src/pages/seo, apps/web/src/pages/admin/SeoCosts.tsx]
related: [data-model.md, ../../decisions/0033-seo-module.md]
---

# SEO

Where a local business shows up on Google Maps, on Google search and in AI answers (ChatGPT, Google's AI Overview,
Perplexity), who beats it keyword by keyword, and what to do next. Built from the mock at `apps/mock/src/pages/seo`.

## Who uses it

A business owner, or a Partner's team working for a Client. Members with the View level see everything; Edit tracks
keywords, questions and competitors; Publish applies changes and posts to the Google profile; Full adds Locations,
changes what checks cost and links the Google profile.

## What it can do

- **Setup** (`/seo/setup`): find the business on Google, confirm it and its services, optionally connect its Google
  Business Profile, pick keywords and questions from ideas (with searches a month), choose the grid and how often, and
  launch. The first check runs on the priority queue and the screen follows it to a first look.
- **Overview** (`/seo/overview`): one number per check with its change over 30 days, the results card from the Google
  profile (calls, website clicks, direction requests, views, and the searches that showed it), and **What to do next**.
- **Google Maps ranking** (`/seo/maps`): every keyword's grid; for one keyword the map now and a month ago, any
  business's map, why the ones ahead are ahead (their profile numbers against yours), and the last 90 days.
- **Keywords** (`/seo/keywords`): your position on Google per keyword, Google's whole first page, map pack and AI Overview.
- **AI answers** (`/seo/ai`): per question and assistant, whether you're named and where, what it said, what it cited.
- **Competitors** (`/seo/competitors`): per channel, who's ahead of you on how many keywords; add or hide one.
- **Settings** (`/seo/settings`): business details, checks within the Plan, the Google profile link, pause or remove.
- **Suggestions**, each saying what it was based on: add categories competitors ahead of you list; get listed on a site
  AI answers cite; track a keyword your profile is found for or a competitor ranks for; say your services in your
  description; track a "People also ask" question; post on your profile. Applying one is an automation Task, so it shows
  in Activity and can be undone; Autopilot can apply a kind on its own.
- **SEO costs** (Settings → App admin): this month's search-data spend per Organization, and each Location's monthly cost.

## How it connects

- **Needs:** the `automation` module (Runs, schedules, Tasks); the app's DataForSEO and Google Places Connections
  (stubs until set live in Admin → Connections); `GOOGLE_CLIENT_ID`/`SECRET` with Business Profile API access for live
  profile changes (without them, connecting Google makes a stub).
- **Feeds:** Activity (every change), automation Runs (every check cycle, with its cost), automation Tasks (applied
  suggestions).
- **Turned off:** the SEO pages leave the bundle and the sidebar; its routes, jobs and tables are gone.

## What's live and what's stubbed

Everything runs end to end on the stub market (dental practices around South Congress, Austin). The live DataForSEO,
Google Places and Google Business Profile calls follow the providers' documented APIs and are covered by tests with
recorded responses, but haven't been run against real accounts. Before going live: connect DataForSEO and Google
Places in Admin → Connections and switch them to live, get Business Profile API access for the Google Cloud project,
and check one real response of each kind against the parsers in `modules/integrations/src/adapters`.

## Later

Search Console and Analytics (clicks and calls behind each keyword), replying to reviews, articles and website fixes,
drafts written by a model rather than templates, and a real map under the grid.
