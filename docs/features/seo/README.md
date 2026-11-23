---
id: seo
kind: feature
module: seo
status: built (stub data until live keys are connected)
depends_on: [automation, integrations, features]
capabilities: [search.maps, search.organic, search.ai, search.keywords, places.find, places.details, profile.manage]
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

- **Setup** (`/seo/setup`): find the business on Google, confirm it, its services and the **categories and cities to
  track** (offered from its full Google profile; add your own), optionally connect its Google
  Business Profile, pick **what to track** in three lists, because each is searched differently: **Google Maps**
  keywords (short, no place: the grid says where), **Google search** keywords (naming the place, or asked in full), and
  **questions for the AI assistants**. Then how far the 7 × 7 grid reaches (0.5 to 10 miles; the screen says the spot
  spacing and the Maps searches a check costs: keywords × 49) and how often, and launch (**Cancel setup** at the top
  leaves for good: a draft is removed). Setup is a full screen without the app menu. The first check runs on the
  priority queue and the screen follows it to a first look; **Leave, we'll keep going** goes to SEO while it runs.
- **Every page's header** says when its data was last checked and, while a check runs, which kind and since when, with
  a link to its status (each kind's results in so far). **Check now** checks what the page shows (Google Maps,
  Google search or AI answers; everything on the overview and competitors) and offers the other kinds in the same
  drawer. A kind already running is skipped, never run twice.
- **Overview** (`/seo/overview`): one number per check with its change over 30 days, the results card from the Google
  profile (calls, website clicks, direction requests, views, and the searches that showed it), and **What to do next**.
- **Google Maps ranking** (`/seo/maps`): every keyword's grid; for one keyword the map now and a month ago, any
  business's map, why the ones ahead are ahead (their profile numbers against yours), and the last 90 days.
- **Keywords** (`/seo/keywords`): your position on Google per keyword, Google's whole first page, map pack and AI Overview.
- **AI answers** (`/seo/ai`): per question and assistant, whether you're named and where, what it said, what it cited.
- **Competitors** (`/seo/competitors`): per channel, who's ahead of you on how many keywords; add or hide one.
- **Settings** (`/seo/settings`): business details, checks within the Plan, the Google profile link, pause or remove. With two or more Locations, a list beside the settings picks which one you're viewing, and
  Select pauses, resumes or removes several together.
- **Suggestions**, each saying what it was based on: add categories competitors ahead of you list; get listed on a site
  AI answers cite; track a keyword your profile is found for or a competitor ranks for; say your services in your
  description; track a "People also ask" question; post on your profile. Applying one is an automation Task, so it shows
  in Activity and can be undone; Autopilot can apply a kind on its own.
- **SEO costs** (Settings → App admin): this month's search-data spend per Organization, and each Location's monthly cost.

## How suggestions are made

No model writes them: everything is rules and templates over data the providers return, so it is predictable and cheap.
This is where to improve it. Code: `modules/seo/src/onboarding/service.ts` (Setup) and
`modules/seo/src/suggestions/generate.ts` (after every check).

**Two different things, kept apart.** *Categories* are a finite list Google defines ("Dentist", "Cosmetic dentist"); a
business lists one primary and some additional ones, and a category can be applied to its profile. *Keywords* are
unlimited: any phrase a customer might search. A category is where a keyword idea starts, never the same thing.

**At Setup**
1. `places.find` (Google Places) gives the business and one category.
2. `places.details` (DataForSEO, Business Data → My Business Info; one request) gives every category it lists, what
   customers mention in reviews (`topics`), questions people ask, and nearby places. The categories are saved on the
   business. Without a details provider Setup carries on from the one category.
3. The person picks the **categories** and **cities** to track (defaults: the first three categories its profile lists, and its city;
   the rest are offered as one-click additions). Both are picked from Google's own lists, kept in the public catalog
   (`modules/seo/src/catalog/`) and refreshed monthly through `places.details`; only a name in a list is accepted,
   and without a list any text is.
   - **Categories** (`seo.place_categories`, with how many businesses list each): typing searches it, most listed first.
     Only Google Business categories are offered, never Google Places type names, and catch-alls Google lists
     ("Services", "Store") are left out. Categories sharing a word with the business's own are offered as "related".
   - **Cities** (`seo.place_cities`, per country; the list of places Google can search from): cities, towns, boroughs and
     neighbourhoods only, not counties, states or postcodes. A place is picked and saved by its label ("Springfield, IL"),
     which names one place, so a name used in several states is never ambiguous; places in the business's own state
     are offered first. A profile's "Austin" is matched to the one in the business's state. A town Google doesn't
     list can't be picked: choose the nearest place that is listed.
4. Ideas (`onboarding/ideas.ts`). Up to 16 seeds, most useful first (each category in the first city, each service in
   it, "mice removal austin", the other cities, the bare category and services, "near me") go to DataForSEO Labs for
   ideas, with what the site already ranks for; a city is searched by its bare name, "springfield". Kept: terms naming a
   chosen city, saying "near me", or sharing a word with a category or service. Then two lists, each built from the
   picks too so neither is ever empty, and each given its searches a month (`keyword_metrics`, one request for all):
   - **Google Maps** (top 30): the categories and services, "<x> near me", and the ideas with the places taken out
     ("exterminator austin tx" is "exterminator"), up to four words.
   - **Google search** (top 50): every category and service in every city, "best <category> in <city>", and the ideas.
   If Labs fails, the screen says so beside the lists and they're built from the picks alone. A keyword is stored once
   with where it's searched (`maps`, `organic`); picking it in both lists tracks it on both and counts once against
   the Plan.
5. Services: the keywords with the city and "near me" removed; else the profile's categories; review topics are offered
   too. Questions: "Who is the best <category> in <city>?", "Which <category>s in <city> have the best reviews?",
   "Where can I get <service> in <city>?", "How much does <service> cost in <city>?", the other categories and
   cities, then the questions people ask about the business.

**After every check** (each suggestion states its evidence and has a fingerprint, so one applied, dismissed or made
pointless never returns):

| Rule | Reads | Suggests |
|---|---|---|
| categories | competitors ahead on the map list categories you lack | add the categories (profile change) |
| listing | AI answers keep citing a directory | get listed there |
| keyword | what your profile is found for, or a competitor's site ranks for | track the keyword |
| description | the profile's description misses tracked services | say them (profile change) |
| question | Google's "People also ask" for your keywords | track the question |
| post | no post on the profile in a month | post |

**Ideas for later**
- **Search Console and Analytics** as sources: keywords with real impressions and clicks (a keyword you get clicks for
  but rank poorly on, or queries you never thought of), pages that earn them, and calls and direction requests per
  keyword. They would feed the `keyword` rule, and replace the guessed seeds with the site's own queries.
- Read Google's category list from the Business Profile API (`categories.list`) instead of DataForSEO, once the Google
  Cloud project has access to it.
- A model to word questions and services from the full profile (`llm.complete`), and to rank suggestions.
- Remember the chosen categories and cities on the Location, so Settings and suggestions use them too.

## How it connects

- **Needs:** the `automation` module (Runs, schedules, Tasks); the app's DataForSEO and Google Places Connections
  (stubs until set live in Admin → Connections; DataForSEO also gives the business's full profile, `places.details`); `GOOGLE_CLIENT_ID`/`SECRET` with Business Profile API access for live
  profile changes (without them, connecting Google makes a stub).
- **Feeds:** Activity (every change), automation Runs (every check cycle, with its cost), automation Tasks (applied
  suggestions).
- **Turned off:** the SEO pages leave the bundle and the sidebar; its routes, jobs and tables are gone.

## What's live and what's stubbed

Everything runs end to end on the stub market (dental practices around South Congress, Austin). The live DataForSEO,
Google Places, business details and Google Business Profile calls follow the providers' documented APIs and are covered by tests with
recorded responses, but haven't been run against real accounts. Before going live: connect DataForSEO and Google
Places in Admin → Connections and switch them to live, get Business Profile API access for the Google Cloud project,
and check one real response of each kind against the parsers in `modules/integrations/src/adapters`.

## Later

Search Console and Analytics (clicks and calls behind each keyword), replying to reviews, articles and website fixes,
drafts written by a model rather than templates, and a real map under the grid.
