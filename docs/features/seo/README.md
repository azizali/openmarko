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
  **questions for the AI assistants**. About six of each, the most searched, are picked and shown as a summary;
  **Change** opens a part's every idea to tick, and a row to add one's own. **How it's checked** is folded to one line
  (how often, how far the map reaches, how many assistants) and opens to the grid (size up to the Plan's
  `seo_grid_size`, reach 0.5 to 10 miles, drawn on a map of where it will search) and the rest. What one check covers,
  what it uses of the Plan and "about 5 minutes" are said once, in a bar kept in view beside **Start first check**,
  which launches (**Cancel setup** at the top
  leaves for good: a draft is removed). Setup is a full screen without the app menu. The first check runs on the
  priority queue and the screen follows it to a first look; **Leave, we'll keep going** goes to SEO while it runs.
- **Google Maps ranking, Google search ranking and AI answers** end their header line with how many open suggestions would move
  that check ("· 3 suggestions"), linking to them on the overview; there's no link when there are none.
- **Every page's header** says, under Check now at its top right, when its data was last checked and, while a check runs, which kind and since when, with
  a link to its status (each kind's results in so far). **Check now** checks what the page shows (Google Maps,
  Google search or AI answers; everything on the overview and competitors) and offers the other kinds in the same
  drawer. A kind already running is skipped, never run twice.
- **Overview** (`/seo/overview`): a row of four figures, one per check with its icon and a small picture of its data in that check's colour (a bar for the share of the area, a square per keyword or answer, competitors split by channel), each with
  its change over 30 days and opening its page; then **What to do next**, with **Behind the numbers** beside it (a
  section per check, titled and with its columns named: the first keywords on Maps and search, each assistant, who
  leads each channel, and the Google profile's results: calls, website clicks, direction requests,
  views, and the searches that showed it). On a phone the figures sit two by two and the suggestions come straight after.
- **Pages are a list, then deep pages.** A section page is its header (one short line) and one table with everything
  known per row; a row opens a full page for that item, with breadcrumbs back up (SEO › section › item). No drawers
  or view switches hide detail: a deep page shows all of it, top to bottom.
- **Google Maps ranking** (`/seo/maps`): one table of every keyword with how much of the area sees it in the top 3, as
  a percentage beside its grid (the count of spots on hover, the change in 30 days in points), average rank and who's #1, and a last row for all keywords together. A keyword
  (`/seo/maps/:keywordId`) shows its map (a real map, MapLibre on OpenFreeMap tiles, no key: zoom with the buttons or
  ctrl/⌘ + scroll, drag to move) beside a ranked leaderboard with each business's rating and reviews, and three tiles
  under the map (top-3 spots, average position, change in 30 days); then **Why they're ahead** (**How you compare**
  when you lead: your profile's facts against #1's as paired bars, and each fact where you're behind the median of the
  ones ahead, main category included); then **Over time** (your top-3 spots as a bar a week, and your grid now beside a
  month ago once one is a month old). `?who=<placeId>` draws another business's
  map. Any business opens its own page (`/seo/maps/places/:placeId`, from `GET …/locations/:id/places/:placeId`): its
  profile, new reviews per week and rating over 90 days from `place_snapshots`, the categories it lists that you don't,
  and where it stands on each of your Maps keywords, each opening that keyword's map drawn for it. Competitors' posts
  aren't tracked.
- **Google search ranking** (`/seo/keywords`, "Google search" in the sidebar): one table with, per keyword, searches a month, your position, its change in 30 days
  and who's first. A keyword (`/seo/keywords/:keywordId`) shows those facts, whether Google's results page showed a map
  pack and an AI Overview (and whether it cites you), your ranking page, your position by week over 90 days and Google's whole first page.
  Google serves scrapers "poisoned" pages (the usual layout, most organic results swapped for loosely related ones), so
  the search asks DataForSEO to `resolve_poisoned_results`: it checks the first page against Google's Web-only results
  and takes the organic list from there when they differ, for one page's extra cost. It also asks it to
  `resolve_goto_urls` (Google's redirect links, otherwise left wrapped on the priority queue), and each Maps spot is
  asked with `search_places: false`, so a place named in the keyword can't move the search away from the spot.
  What a request costs (`searchPriceUsd`: Google search per 10 results plus a page each for the AI Overview and the
  poisoned-page check, Maps per 100 places) prices both stub checks and the admin's monthly estimate.
- **AI answers** (`/seo/ai`): one table of question × assistant (whether you're named and where, and the sites cited),
  a last row with each assistant's total, and the sites answers lean on most. A question (`/seo/ai/:questionId`) shows
  a card per assistant with its mark: whether it names you and where, its answer with your name highlighted, who else
  it named, and what it cited.
- **Competitors** (`/seo/competitors`): per channel (a filter above the table), who's ahead of you on how many keywords
  and where they beat you most, the ones ahead first and the rest saying "Not ahead", with a totals row; add one by
  hand, or hide or unhide one. A competitor (`/seo/competitors/:id`) is one card with a section per channel they show
  up in, their result beside yours for every keyword or question (the ones they win first, marked), each linking to
  that keyword's page (on Maps, drawn for them); the channels they don't show up in are named in one line under it,
  and their Google profile is linked beside the badges when they have one.
- **Settings** (`/seo/settings`): one card of sections (business details; checks within the Plan, with the grid's shape and each assistant's mark; the Google profile link; pause; remove), each with its one action, and the grid size and reach edited with the same map preview as setup. With two or more Locations, a list beside the settings picks which one you're viewing, and
  Select pauses, resumes or removes several together.
- **Suggestions**, each saying what it was based on: add categories competitors ahead of you list; get listed on a site
  AI answers cite; track a keyword your profile is found for or a competitor ranks for; say your services in your
  description; track a "People also ask" question; post on your profile. Applying one is an automation Task, so it shows
  in Activity and can be undone; Autopilot can apply a kind on its own.
- **SEO costs** (Settings → App admin): this month's search-data spend per Organization, and each Location's monthly cost.

## In the chat

A member's chat knows what SEO does and which page shows what (the module's `assistantBrief`), and can read the same
numbers as the pages, for members whose Role has SEO's View (ADR 0036, `modules/seo/src/tools.ts`):

| Tool | Answers |
|---|---|
| `seo.list_locations` | the businesses tracked, where checks run and how often |
| `seo.overview` | where a business stands on each channel, with changes over 30 days, and its Google profile's results |
| `seo.maps_rankings` | each Maps keyword: top-3 spots on the grid, average position, change, who is first |
| `seo.maps_keyword` | one Maps keyword's board: who ranks, with rating, reviews and categories |
| `seo.search_rankings` | each search keyword: searches a month, position, change, who is first, map pack and AI Overview |
| `seo.ai_answers` | each question per assistant: named or not, who else is named, which sites are cited |
| `seo.competitors` | who is ahead on a channel, and on how many keywords |
| `seo.suggestions` | the open suggestions, with what they'd improve and why |

A tool works on the business it's asked about (by name), else the one on the member's page (`?location=`), else the
only one; with several and none named, it asks which. Tracking keywords and applying suggestions from the chat come
later, as tools that propose Tasks.

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

**Keeping what was picked.** The categories and cities picked on What we found are saved on the Location
(`categories`, `cities`) and edited in Settings → Business; ideas are built from what's saved, so a reload or the round
trip through Google's sign-in asks for the same ones. What's ticked on What to track is kept for the browser tab until
launch, so Back and on again keeps it.

**Stopping a keyword** is per place: Stop tracking on Google Maps or on Google search turns it off there only; off in both,
it's no longer tracked and stops counting against the Plan. Stopping a keyword or a question happens at once with an
**Undo** in the message, rather than an "Are you sure?".

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
- Use the saved categories and cities in suggestions (Setup and Settings already do).

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
