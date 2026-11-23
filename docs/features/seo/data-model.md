# SEO: data model

Status: **built** (`modules/seo/src/schema.ts`, migration `0004_seo`). Q1 to Q12 refer to the planning questions; every one
is decided below. ADR 0033 records the decisions.

What changed while building (2026-11-22):

- Locations are checked on **automation's schedule** (one `automation.schedules` row per Location, job `seo.check`), so there
  is no `next_check_at`. Each cycle of checks is one automation Run; its cost is the sum of its provider calls.
- `locations` also keeps `city`, `country_code`, `services` (keyword and question ideas come from them) and `engines` (the
  AI assistants its questions are asked of). `check_every` is `daily`, `weekly` or `monthly`.
- `keyword_metrics` is keyed by `country_code` (two letters) rather than a provider location code.
- `checks` also keeps `queue`, `calls` and `error`; its status is `running`, `filing` (claimed by the one collection that
  files it), `done` or `failed`. `provider_tasks.raw` holds the normalised result and `error` why a task failed.
- `suggestions.score` orders the list (higher first).
- A business is set up once per Organization: a partial unique index on `locations (organization_id, place_id)` for
  Locations that aren't archived (migration `0005`).
- "Checking" and a cycle's "finished" follow its automation Run, which finishes after the suggestions are written.

Decided (2026-11-21):

- Q1: an Organization has several Locations; the SEO pages show a Location switcher only when there's more than one.
- Q2: Websites are their own table.
- Q3: the public catalog is shared across Organizations.
- Q5: DataForSEO is the app's own account; customers pay through Plan limits, real spend is tracked per Organization.
- Q6: scheduled checks use the standard queue with postback (polling as fallback); the first check at Launch uses priority.
- Q7: v1 uses Google Business Profile and Places; Search Console and Analytics come later.
- Q8: engines are ChatGPT, Google AI Overviews and Perplexity.
- Q9: grid size and how often a Location is checked are limited by the Plan (`limit.seo_grid_size`, `limit.seo_checks_per_month`).
- Q10: API costs becomes an App admin page with real spend per Organization.
- Q11: onboarding starts after creating an Organization when SEO is on, and from the SEO page with no Location; customers see Plan usage, not dollars.

- Q4: applying a suggestion goes through an automation Task executor (Apply, Undo, Activity, Autopilot); the `seo`
  module depends on `automation`.
- Q12: v1 includes competitor facts from Maps results, the results card (Business Profile performance), and three
  more suggestion kinds: get listed, question ideas from "People also ask", and profile gaps. Review replies are not
  in v1, so there is no `reviews` table yet.
- Google Business Profile API access is not approved yet; the Google adapter is built and tested in stub mode until
  it is.

All tables live in the Postgres schema `seo`. Ids are UUIDv7 made in the app. Timestamps are `timestamptz`.

## The three layers

1. **Public catalog.** Facts about the outside world that are the same for everyone: Google businesses, their
   ratings over time, monthly searches for a term. No `organization_id`. A row says nothing about who tracks it (Q3).
2. **What an Organization tracks.** Its Locations, Websites, keywords, questions, competitor exceptions and
   suggestions. Every row has `organization_id` and cascades when the Organization is deleted.
3. **Results.** What each check found, over time. Summaries are worked out once, when results arrive, so pages
   read small tables and never add up raw data on request.

Rule for `organization_id`: a table that routes query directly carries it (for scoping and cascade). A pure child
row (a grid spot, a SERP item, an AI mention) cascades from its parent and does not repeat it.

## Overview

```mermaid
erDiagram
    auth_organization ||--o{ websites : owns
    auth_organization ||--o{ locations : owns
    websites |o--o{ locations : "serves"
    places |o--o{ locations : "is (Google profile)"
    integrations_connections |o--o{ locations : "Google Business Profile"

    locations ||--o{ keywords : tracks
    locations ||--o{ questions : tracks
    locations ||--o{ competitor_overrides : "adds or hides"
    places ||--o{ competitor_overrides : ""
    keyword_metrics |o--o{ keywords : "searches a month"

    locations ||--o{ checks : "is checked"
    checks ||--o{ provider_tasks : "sent to DataForSEO"
    automation_runs |o--o{ checks : "cost and log"

    checks ||--o{ map_scans : "Maps check"
    checks ||--o{ serp_results : "Keywords check"
    checks ||--o{ ai_answers : "AI answers check"

    places ||--o{ place_snapshots : "rating over time"
    locations ||--o{ suggestions : "what to do next"
    automation_tasks |o--o| suggestions : "Apply / Undo"
```

Outside the `seo` schema: `auth.organization` (Better Auth), `integrations.connections` (the Google Connection),
`automation.runs` and `automation.tasks` (Q4). Usage and cost per DataForSEO call are recorded by
`integrations.invoke()` as for any metered provider.

## 1. Public catalog

```mermaid
erDiagram
    places ||--o{ place_snapshots : ""

    places {
        uuid id PK
        text google_place_id UK "ChIJ..."
        text cid "Google's numeric id, from Maps results"
        text name
        text primary_category
        text_array categories
        text address
        float lat
        float lng
        text domain "null when none"
        text phone
        timestamptz first_seen_at
        timestamptz updated_at
    }
    place_snapshots {
        uuid place_id PK,FK
        date observed_on PK
        numeric rating
        int review_count
        int photo_count "null when the source doesn't say"
        bool is_claimed
        text source "maps | business_data | gbp"
    }
    keyword_metrics {
        uuid id PK
        text term
        text country_code "two letters"
        text language_code
        int monthly_searches
        numeric cpc
        numeric competition
        int_array trend "last 12 months"
        timestamptz refreshed_at
    }
```

- `places` gets one row per business seen in any result, upserted by `google_place_id`. Competitors are rows here,
  not a list somebody types.
- `place_snapshots` keeps at most one row per place per day. Maps results already carry rating, review count,
  categories and claimed, so most snapshots cost nothing. New reviews a month is the change between two snapshots.
- `keyword_metrics` is unique on `(term, country_code, language_code)` and refreshed monthly, once, however many
  Organizations track the term.

## 2. What an Organization tracks

```mermaid
erDiagram
    websites |o--o{ locations : ""
    locations ||--o{ keywords : ""
    locations ||--o{ questions : ""
    locations ||--o{ competitor_overrides : ""

    websites {
        uuid id PK
        text organization_id FK
        text domain "unique per Organization"
        timestamptz created_at
    }
    locations {
        uuid id PK
        text organization_id FK
        uuid website_id FK "null: no website"
        uuid place_id FK "null until matched"
        text name
        text address
        float lat
        float lng
        text timezone
        text city
        text country_code
        text language_code
        text_array services
        text_array categories "Google's categories picked to track"
        text_array cities "Google's places picked to track, like Springfield, IL"
        text_array engines
        text status "draft | active | paused | archived"
        smallint grid_size "5, 7 or 9"
        int grid_radius_m
        text check_every "daily | weekly | monthly"
        uuid gbp_connection_id FK "integrations.connections"
        text gbp_location_name "locations/123..."
        text created_by
        timestamptz created_at
    }
    keywords {
        uuid id PK
        text organization_id FK
        uuid location_id FK
        text term "unique per Location"
        uuid metric_id FK "keyword_metrics"
        bool active
        bool maps "searched on Google Maps from every grid spot"
        bool organic "searched on Google search"
        text source "onboarding | suggestion | manual"
        text created_by
        timestamptz created_at
    }
    questions {
        uuid id PK
        text organization_id FK
        uuid location_id FK
        text text "unique per Location"
        bool active
        text source "onboarding | suggestion | manual"
        text created_by
        timestamptz created_at
    }
    competitor_overrides {
        uuid id PK
        text organization_id FK
        uuid location_id FK
        uuid place_id FK
        text action "added | hidden"
        text created_by
        timestamptz created_at
    }
```

- A Location is the business being tracked (Q1: several per Organization). Its status is `draft` through
  onboarding and becomes `active` at Launch.
- A Website can serve several Locations (Q2). Google search positions are read for the Website's domain.
- Competitors found in results are never stored as tracked rows. `competitor_overrides` holds only the exceptions:
  added by hand (shown as **Added by you** until the next check) or hidden.
- Plan limits count rows here: `limit.seo_locations`, `limit.seo_keywords` (active keywords per Location),
  `limit.seo_questions`.

## 3. Checks and the calls behind them

```mermaid
erDiagram
    locations ||--o{ checks : ""
    checks ||--o{ provider_tasks : ""

    checks {
        uuid id PK
        text organization_id FK
        uuid location_id FK
        text kind "maps | organic | ai"
        text status "running | filing | done | failed"
        text queue "standard | priority"
        int calls
        text error
        uuid run_id FK "automation.runs, Q4"
        int calls
        bigint cost_micros
        timestamptz queued_at
        timestamptz finished_at
    }
    provider_tasks {
        uuid id PK
        uuid check_id FK
        text external_task_id UK "DataForSEO task id"
        text endpoint
        jsonb target "keyword or question id, grid spot, engine"
        text status "posted | received | failed"
        bigint cost_micros
        jsonb raw "kept 30 days, to re-read after a parser fix"
        timestamptz posted_at
        timestamptz received_at
    }
```

- One `checks` row per Location per kind per cycle. "Checked Monday" on the overview is the latest finished check.
- `provider_tasks` exists because DataForSEO's standard queue is asynchronous (Q6): we post tasks, DataForSEO
  calls back (postback) or we poll, and this table matches each result to its keyword, spot or question. A check is
  done when all its tasks are received; then the summaries below are written in one transaction.

## 4. Results

### Maps check

```mermaid
erDiagram
    map_scans ||--|{ map_points : "one per spot"
    map_scans ||--|{ map_standings : "one per business"
    places ||--o{ map_standings : ""

    map_scans {
        uuid id PK
        text organization_id FK
        uuid location_id FK
        uuid check_id FK
        uuid keyword_id FK
        timestamptz checked_at
        smallint grid_size
        int radius_m
        float center_lat
        float center_lng
        smallint your_top3_spots
        numeric your_avg_position "21 where not found"
        smallint your_door_position
    }
    map_points {
        uuid scan_id PK,FK
        smallint idx PK "row * size + col"
        float lat
        float lng
        smallint your_rank "null: not in the top 20"
        uuid_array ranking "place ids, in order, top 20"
    }
    map_standings {
        uuid scan_id PK,FK
        uuid place_id PK,FK
        smallint top3_spots
        numeric avg_position
        smallint door_position
        text best_side "north | south | east | west"
        text worst_side
    }
```

- `map_points.ranking` keeps the whole order at a spot in one row: 49 rows per scan rather than about 980. Anyone's
  map (yours or a competitor's) is rebuilt from it, and tapping a spot shows its top 3.
- `map_standings` is the summary the pages read: who holds how many spots, who leads, **Compare profiles**, and the
  90-day chart (one row per business per weekly scan). Your own Location's place has a row too.

### Keywords check (Google search)

```mermaid
erDiagram
    serp_results ||--|{ serp_items : "first page"
    places |o--o{ serp_items : ""

    serp_results {
        uuid id PK
        text organization_id FK
        uuid location_id FK
        uuid check_id FK
        uuid keyword_id FK
        timestamptz checked_at
        smallint your_position "null: not in the depth read"
        text your_url
        bool has_map_pack
        bool has_ai_overview
        bool ai_overview_cites_you
        text_array people_also_ask "ideas for AI questions"
    }
    serp_items {
        uuid result_id PK,FK
        smallint position PK
        text domain
        text url
        text title
        text item_type "organic | directory"
        uuid place_id FK "when the domain is a known business"
    }
```

### AI answers check

```mermaid
erDiagram
    ai_answers ||--o{ ai_mentions : "names"
    ai_answers ||--o{ ai_citations : "cites"
    places |o--o{ ai_mentions : ""

    ai_answers {
        uuid id PK
        text organization_id FK
        uuid location_id FK
        uuid check_id FK
        uuid question_id FK
        text engine "chatgpt | google_ai | perplexity, Q8"
        timestamptz checked_at
        bool named_you
        smallint your_position "place in its list"
        text excerpt "the opening, as a person reads it"
    }
    ai_mentions {
        uuid answer_id PK,FK
        smallint position PK
        text name "as the answer wrote it"
        uuid place_id FK "null when not matched"
    }
    ai_citations {
        uuid answer_id PK,FK
        smallint position PK
        text domain
        text url
    }
```

- Answers name businesses as free text; `place_id` is filled when the name matches a place nearby. Unmatched
  names still count in **Competitors** under the AI answers channel.
- `ai_citations` feeds the "Get listed on Healthgrades" kind of suggestion (Q12).

### Competitors check

No table of its own. It reads `map_standings`, `serp_items` and `ai_mentions` for the Location's latest checks,
minus `competitor_overrides` hidden, plus those added, and the newest `place_snapshots` for profile facts.

## 5. Suggestions

```mermaid
erDiagram
    locations ||--o{ suggestions : ""
    checks |o--o{ suggestions : "written after"
    automation_tasks |o--o| suggestions : "Apply / Undo"

    suggestions {
        uuid id PK
        text organization_id FK
        uuid location_id FK
        text kind "track_keyword | track_question | profile_change | post | listing"
        text helps "maps | keywords | ai"
        text title
        text why
        jsonb evidence "list of sentences"
        jsonb payload "typed per kind"
        text fingerprint "unique per Location"
        float score
        text status "open | applied | dismissed | expired"
        uuid check_id FK
        uuid task_id FK "automation.tasks, Q4"
        text decided_by
        timestamptz decided_at
        timestamptz created_at
    }
```

- `payload` is a union checked by a zod schema per `kind`: a term to track; a profile field before and after; a
  post's text; a directory to get listed on.
- `fingerprint` (kind plus its subject, such as `track_keyword:emergency dentist austin`) stops a dismissed or
  applied suggestion coming back each week.
- Apply and Undo go through an automation Task executor, which keeps the revert data, writes Activity and lets
  Autopilot act (Q4). `listing` and profile gaps (a `profile_change` with an empty before) come from the
  improvements (Q12); question ideas from "People also ask" are `track_question` suggestions.

## 6. With Google Business Profile connected (Q12)

```mermaid
erDiagram
    locations ||--o{ profile_metrics : "daily"
    locations ||--o{ profile_search_terms : "monthly"

    profile_metrics {
        uuid location_id PK,FK
        date day PK
        text organization_id FK
        int calls
        int website_clicks
        int direction_requests
        int impressions_maps
        int impressions_search
    }
    profile_search_terms {
        uuid location_id PK,FK
        date month PK
        text term PK
        text organization_id FK
        int impressions
    }
```

From the Business Profile APIs, only for a connected Location. `profile_metrics` is the **results** card on the
overview (are rankings turning into calls?); `profile_search_terms` are real searches that showed the profile and
seed keyword suggestions. Reviews (and replying to them) are not in v1.

## Volume and growth

One Location with 20 keywords, a 7 × 7 grid, 5 questions on 3 engines, checked weekly, writes about 8,000 rows a
month (4,200 `map_points`, 2,000 `map_standings`, 860 `serp_items`, 65 `ai_answers` and their children). A thousand
Locations is about 8 million rows a month.

- Every results table is indexed on `(location_id, checked_at)` or reached through its parent's primary key.
- Summaries (`map_scans`, `map_standings`, `serp_results`, `ai_answers`) are kept indefinitely; spot-level rows
  (`map_points`) and `provider_tasks.raw` can be pruned on a schedule (13 months and 30 days).
- If tables grow past what indexes handle, the results tables split by month on `checked_at` (children would then
  carry `checked_at` too). No query changes.
