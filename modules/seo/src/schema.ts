// The SEO module's tables, in three layers (docs/features/seo/data-model.md):
//   1. The public catalog: Google businesses, their ratings over time, keyword volumes. Shared by every
//      Organization, with no organization_id: a row says nothing about who tracks it.
//   2. What an Organization tracks: Locations, Websites, keywords, questions, competitor exceptions, suggestions.
//   3. Results: what each check found. Summaries (map_scans, map_standings, serp_results, ai_answers, site_audits,
//      audit_issues) are written once when results arrive, so pages read small tables.
// Rule for organization_id: a table routes query directly carries it; a pure child row cascades from its parent.

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authOrganization } from "@app/kernel";

export const seo = pgSchema("seo");

const org = () =>
  text("organization_id")
    .notNull()
    .references(() => authOrganization.id, { onDelete: "cascade" });
const createdAt = (name = "created_at") =>
  timestamp(name, { withTimezone: true })
    .notNull()
    .default(sql`now()`);
const at = (name: string) => timestamp(name, { withTimezone: true });

// ==================== 1. Public catalog ====================

/**
 * Google's own list of business categories ("Pest control service"), fetched from the details provider and refreshed
 * monthly. Setup offers from it, and only a name in it is accepted as a category to track. Shared by everyone.
 */
export const placeCategories = seo.table("place_categories", {
  name: text("name").primaryKey(),
  /** How many businesses Google lists under it: the order categories are offered in. */
  businesses: integer("businesses").notNull().default(0),
  fetchedAt: at("fetched_at")
    .notNull()
    .default(sql`now()`),
});

/**
 * The places Google can search from (cities, towns, boroughs, neighbourhoods), per country, fetched from the details
 * provider and refreshed monthly. `code` is the provider's id for the place; `label` is how it's shown and picked
 * ("Springfield, IL"), unique within a country; `city` is the bare name people type in a search ("springfield").
 */
export const placeCities = seo.table(
  "place_cities",
  {
    code: integer("code").primaryKey(),
    countryCode: text("country_code").notNull(),
    label: text("label").notNull(),
    city: text("city").notNull(),
    /** The state or region the place is in (full name), for ranking places near the business first. */
    region: text("region"),
    type: text("type").notNull(),
    fetchedAt: at("fetched_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("place_cities_label").on(t.countryCode, t.label)],
);

/** One Google business, seen in any result or looked up. Competitors are rows here, never typed in. */
export const places = seo.table(
  "places",
  {
    id: uuid("id").primaryKey(),
    googlePlaceId: text("google_place_id").notNull(),
    cid: text("cid"),
    name: text("name").notNull(),
    primaryCategory: text("primary_category"),
    categories: text("categories")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    domain: text("domain"),
    phone: text("phone"),
    firstSeenAt: createdAt("first_seen_at"),
    updatedAt: at("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("places_google").on(t.googlePlaceId), index("places_domain").on(t.domain)],
);

/** A business's public numbers on a day. Maps results carry them, so most cost nothing. One row per place per day. */
export const placeSnapshots = seo.table(
  "place_snapshots",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    observedOn: date("observed_on").notNull(),
    rating: doublePrecision("rating"),
    reviewCount: integer("review_count"),
    photoCount: integer("photo_count"),
    isClaimed: boolean("is_claimed"),
    source: text("source").notNull(), // 'maps' | 'business_data' | 'gbp'
  },
  (t) => [primaryKey({ columns: [t.placeId, t.observedOn] })],
);

/** Searches a month for a term in a country and language. Refreshed monthly, once for everyone who tracks it. */
export const keywordMetrics = seo.table(
  "keyword_metrics",
  {
    id: uuid("id").primaryKey(),
    term: text("term").notNull(),
    countryCode: text("country_code").notNull(),
    languageCode: text("language_code").notNull(),
    monthlySearches: integer("monthly_searches"),
    cpc: doublePrecision("cpc"),
    competition: doublePrecision("competition"),
    trend: integer("trend")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    refreshedAt: at("refreshed_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("keyword_metrics_key").on(t.term, t.countryCode, t.languageCode)],
);

// ==================== 2. What an Organization tracks ====================

/** A domain. One or more Locations point at it; Google search positions are read for it. */
export const websites = seo.table(
  "websites",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    domain: text("domain").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("websites_domain").on(t.organizationId, t.domain)],
);

/** The business being tracked: where it is, how its checks run, and its Google profile. */
export const locations = seo.table(
  "locations",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    websiteId: uuid("website_id").references(() => websites.id, { onDelete: "set null" }),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    countryCode: text("country_code").notNull().default("US"),
    languageCode: text("language_code").notNull().default("en"),
    /** What the business offers, read from its site and profile: keyword and question ideas come from these. */
    services: text("services")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /**
     * What's tracked, as picked at Setup: Google's categories ("Pest control service") and Google's places
     * ("Springfield, IL"). Keyword ideas are each category in each place. Empty until picked.
     */
    categories: text("categories")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    cities: text("cities")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text("status").notNull(), // 'draft' | 'active' | 'paused' | 'archived'
    gridSize: smallint("grid_size").notNull().default(7), // 5, 7 or 9 spots a side
    gridRadiusM: integer("grid_radius_m").notNull().default(3000),
    checkEvery: text("check_every").notNull().default("weekly"), // 'daily' | 'weekly' | 'monthly'
    /** The AI assistants its questions are asked of. */
    engines: text("engines")
      .array()
      .notNull()
      .default(sql`'{chatgpt,google_ai,perplexity}'::text[]`),
    gbpConnectionId: uuid("gbp_connection_id"), // integrations.connections, when its Google profile is linked
    gbpLocationName: text("gbp_location_name"), // 'accounts/1/locations/2'
    createdBy: text("created_by"),
    createdAt: createdAt(),
    updatedAt: at("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("locations_org").on(t.organizationId, t.status),
    // A business is tracked once per Organization (a removed one can be added again).
    uniqueIndex("locations_place")
      .on(t.organizationId, t.placeId)
      .where(sql`status <> 'archived' and place_id is not null`),
  ],
);

/** A keyword tracked for a Location, on Google Maps and Google search. */
export const keywords = seo.table(
  "keywords",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    metricId: uuid("metric_id").references(() => keywordMetrics.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    /**
     * Where it's searched: on Google Maps from every spot of the grid, and on Google search once. People search the two
     * differently ("exterminator" on the map, "exterminator austin tx" on Google), so a keyword can be on one or both.
     */
    maps: boolean("maps").notNull().default(true),
    organic: boolean("organic").notNull().default(true),
    source: text("source").notNull(), // 'onboarding' | 'suggestion' | 'manual'
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("keywords_term").on(t.locationId, t.term)],
);

/**
 * A key page: a page of the Location's website it most wants customers to land on (a service, a booking page), for
 * the keywords in key_page_keywords. Other pages about the same thing should link to it (key-pages/logic.ts). A page
 * suggested as one and turned down is kept as `declined`, so it isn't suggested again. `path` is the page's address
 * without the domain ("/termite-control"), so a crawl over http or www still finds it.
 */
export const keyPages = seo.table(
  "key_pages",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    status: text("status").notNull().default("key"), // 'key' | 'declined'
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("key_pages_path").on(t.locationId, t.path)],
);

/** The tracked keywords a key page is for. A keyword is for one key page at most. */
export const keyPageKeywords = seo.table("key_page_keywords", {
  keywordId: uuid("keyword_id")
    .primaryKey()
    .references(() => keywords.id, { onDelete: "cascade" }),
  keyPageId: uuid("key_page_id")
    .notNull()
    .references(() => keyPages.id, { onDelete: "cascade" }),
});

/** A question asked of the AI assistants for a Location, the way a customer would ask it. */
export const questions = seo.table(
  "questions",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    active: boolean("active").notNull().default(true),
    source: text("source").notNull(), // 'onboarding' | 'suggestion' | 'manual'
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("questions_text").on(t.locationId, t.text)],
);

/** The exceptions to found competitors: one added by hand, or one hidden. */
export const competitorOverrides = seo.table(
  "competitor_overrides",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // 'added' | 'hidden'
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("competitor_overrides_place").on(t.locationId, t.placeId)],
);

// ==================== 3. Checks and results ====================

/** One run of one kind of check for a Location. Done when every provider task it sent has come back. */
export const checks = seo.table(
  "checks",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'maps' | 'organic' | 'ai' | 'audit'
    status: text("status").notNull(), // 'running' | 'filing' | 'done' | 'failed'
    runId: uuid("run_id"), // automation.runs: the cycle this check belongs to, and its cost
    queue: text("queue").notNull(), // 'standard' | 'priority'
    calls: integer("calls").notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    error: text("error"),
    queuedAt: createdAt("queued_at"),
    finishedAt: at("finished_at"),
  },
  (t) => [index("checks_location").on(t.locationId, t.kind, t.queuedAt), index("checks_run").on(t.runId)],
);

/** One request to the search-data provider: what it asked, and when its result came back. */
export const providerTasks = seo.table(
  "provider_tasks",
  {
    id: uuid("id").primaryKey(),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    externalTaskId: text("external_task_id").notNull(),
    /** What it was for: a keyword or question id, a grid spot, an engine; and the query sent. */
    target: jsonb("target").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull(), // 'posted' | 'received' | 'failed'
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    /**
     * The normalised result, kept 30 days so results can be re-read after a parser fix. DataForSEO's whole response is
     * kept longer as a file: `readOriginal(ctx, "dataforseo", <the task id in external_task_id>)` (ADR 0035).
     */
    raw: jsonb("raw").$type<unknown>(),
    error: text("error"),
    postedAt: createdAt("posted_at"),
    receivedAt: at("received_at"),
  },
  (t) => [
    uniqueIndex("provider_tasks_external").on(t.externalTaskId),
    index("provider_tasks_waiting")
      .on(t.postedAt)
      .where(sql`status = 'posted'`),
    index("provider_tasks_check").on(t.checkId),
  ],
);

// ---------- Maps ----------

/** One keyword's map grid in one check, with your summary worked out. */
export const mapScans = seo.table(
  "map_scans",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    keywordId: uuid("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    checkedAt: at("checked_at").notNull(),
    gridSize: smallint("grid_size").notNull(),
    radiusM: integer("radius_m").notNull(),
    centerLat: doublePrecision("center_lat").notNull(),
    centerLng: doublePrecision("center_lng").notNull(),
    yourTop3Spots: smallint("your_top3_spots").notNull(),
    /** Over every spot, counting 21 where you're not in the top 20. */
    yourAvgPosition: doublePrecision("your_avg_position").notNull(),
    yourDoorPosition: smallint("your_door_position"),
  },
  (t) => [index("map_scans_location").on(t.locationId, t.checkedAt), uniqueIndex("map_scans_check_keyword").on(t.checkId, t.keywordId)],
);

/** One spot of a grid: the whole order there, so anyone's map can be rebuilt from it. */
export const mapPoints = seo.table(
  "map_points",
  {
    scanId: uuid("scan_id")
      .notNull()
      .references(() => mapScans.id, { onDelete: "cascade" }),
    idx: smallint("idx").notNull(), // row * size + col
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    yourRank: smallint("your_rank"), // null: not in the top 20
    /** Place ids in order, top 20. Empty when the spot's search failed. */
    ranking: uuid("ranking").array().notNull(),
  },
  (t) => [primaryKey({ columns: [t.scanId, t.idx] })],
);

/** How each business did on one grid: what the leaderboards, "why they're ahead" and the charts read. */
export const mapStandings = seo.table(
  "map_standings",
  {
    scanId: uuid("scan_id")
      .notNull()
      .references(() => mapScans.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    top3Spots: smallint("top3_spots").notNull(),
    avgPosition: doublePrecision("avg_position").notNull(),
    doorPosition: smallint("door_position"),
    bestSide: text("best_side"), // 'north' | 'south' | 'east' | 'west'; null when in the top 3 nowhere
    worstSide: text("worst_side"),
  },
  (t) => [primaryKey({ columns: [t.scanId, t.placeId] }), index("map_standings_place").on(t.placeId)],
);

// ---------- Google search ----------

/** One keyword's Google search in one check: your position and what the page shows. */
export const serpResults = seo.table(
  "serp_results",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    keywordId: uuid("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    checkedAt: at("checked_at").notNull(),
    yourPosition: smallint("your_position"), // null: not in the depth read
    yourUrl: text("your_url"),
    hasMapPack: boolean("has_map_pack").notNull(),
    hasAiOverview: boolean("has_ai_overview").notNull(),
    aiOverviewCitesYou: boolean("ai_overview_cites_you").notNull(),
    peopleAlsoAsk: text("people_also_ask")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [
    index("serp_results_location").on(t.locationId, t.checkedAt),
    uniqueIndex("serp_results_check_keyword").on(t.checkId, t.keywordId),
  ],
);

/** Google's first page for a keyword, in order. */
export const serpItems = seo.table(
  "serp_items",
  {
    resultId: uuid("result_id")
      .notNull()
      .references(() => serpResults.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    domain: text("domain").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    itemType: text("item_type").notNull(), // 'business' (a known place's site) | 'directory' (anything else)
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.resultId, t.position] }), index("serp_items_domain").on(t.domain)],
);

// ---------- AI answers ----------

/** One question's answer from one assistant in one check. */
export const aiAnswers = seo.table(
  "ai_answers",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    engine: text("engine").notNull(), // 'chatgpt' | 'google_ai' | 'perplexity'
    checkedAt: at("checked_at").notNull(),
    namedYou: boolean("named_you").notNull(),
    yourPosition: smallint("your_position"),
    /** The opening of the answer, as a person reads it. */
    excerpt: text("excerpt").notNull(),
  },
  (t) => [
    index("ai_answers_location").on(t.locationId, t.checkedAt),
    uniqueIndex("ai_answers_check").on(t.checkId, t.questionId, t.engine),
  ],
);

/** The businesses an answer names, in order. */
export const aiMentions = seo.table(
  "ai_mentions",
  {
    answerId: uuid("answer_id")
      .notNull()
      .references(() => aiAnswers.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    name: text("name").notNull(),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.answerId, t.position] })],
);

/** The sites an answer leaned on. */
export const aiCitations = seo.table(
  "ai_citations",
  {
    answerId: uuid("answer_id")
      .notNull()
      .references(() => aiAnswers.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    domain: text("domain").notNull(),
    url: text("url").notNull(),
  },
  (t) => [primaryKey({ columns: [t.answerId, t.position] }), index("ai_citations_domain").on(t.domain)],
);

// ---------- Site audit ----------

/**
 * One crawl of a Location's website, in one check: its health and what it says about itself as a whole. The check
 * row is the audit (one per audit check), so its id is the check's.
 */
export const siteAudits = seo.table(
  "site_audits",
  {
    checkId: uuid("check_id")
      .primaryKey()
      .references(() => checks.id, { onDelete: "cascade" }),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    checkedAt: at("checked_at").notNull(),
    pagesCrawled: integer("pages_crawled").notNull(),
    /** 0 to 100, from the kinds of issue found (audit/issues.ts). */
    health: smallint("health").notNull(),
    homeUrl: text("home_url").notNull(),
    schemaTypes: text("schema_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    phones: text("phones")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** The AI crawlers its robots.txt shuts out of the whole site. */
    blockedBots: text("blocked_bots")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    llmsTxt: boolean("llms_txt").notNull(),
  },
  (t) => [index("site_audits_location").on(t.locationId, t.checkedAt)],
);

/** One page of a crawl: what it says, and the issues found on it (codes from audit/issues.ts). */
export const auditPages = seo.table(
  "audit_pages",
  {
    checkId: uuid("check_id")
      .notNull()
      .references(() => siteAudits.checkId, { onDelete: "cascade" }),
    url: text("url").notNull(),
    statusCode: smallint("status_code").notNull(),
    depth: smallint("depth"),
    title: text("title"),
    /** The page's main heading: with its title and address, what the page is about (key-pages/logic.ts). */
    h1: text("h1"),
    wordCount: integer("word_count"),
    loadMs: integer("load_ms"),
    issues: text("issues")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [primaryKey({ columns: [t.checkId, t.url] })],
);

/**
 * Each kind of issue one crawl found: what the Site audit page lists. `count` is pages for a page issue, and items for
 * a site-wide one (the services without a page, the AI crawlers shut out), which `items` names.
 */
export const auditIssues = seo.table(
  "audit_issues",
  {
    checkId: uuid("check_id")
      .notNull()
      .references(() => siteAudits.checkId, { onDelete: "cascade" }),
    code: text("code").notNull(),
    count: integer("count").notNull(),
    items: text("items")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [primaryKey({ columns: [t.checkId, t.code] })],
);

/**
 * The links between the site's own pages that one crawl found (at most AUDIT_LINKS): what Key pages reads, to
 * see which pages already link where. One row per pair; the first anchor wins.
 */
export const auditLinks = seo.table(
  "audit_links",
  {
    checkId: uuid("check_id")
      .notNull()
      .references(() => siteAudits.checkId, { onDelete: "cascade" }),
    fromUrl: text("from_url").notNull(),
    toUrl: text("to_url").notNull(),
    anchor: text("anchor"),
  },
  (t) => [primaryKey({ columns: [t.checkId, t.fromUrl, t.toUrl] })],
);

// ---------- Suggestions ----------

/** What to do next. Applying one goes through an automation Task, which keeps what Undo needs. */
export const suggestions = seo.table(
  "suggestions",
  {
    id: uuid("id").primaryKey(),
    organizationId: org(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'track_keyword' | 'track_question' | 'profile_change' | 'post' | 'listing' | 'site_fix' | 'add_link'
    /** The check it should move most. A site fix may move others too (its payload's `helps`). */
    helps: text("helps").notNull(), // 'maps' | 'keywords' | 'ai'
    title: text("title").notNull(),
    why: text("why").notNull(),
    evidence: jsonb("evidence").$type<string[]>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** Kind and subject: a dismissed or applied suggestion doesn't come back. */
    fingerprint: text("fingerprint").notNull(),
    status: text("status").notNull(), // 'open' | 'applied' | 'dismissed' | 'expired'
    /** Higher first. */
    score: doublePrecision("score").notNull().default(0),
    checkId: uuid("check_id").references(() => checks.id, { onDelete: "set null" }),
    taskId: uuid("task_id"), // automation.tasks
    decidedBy: text("decided_by"),
    decidedAt: at("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("suggestions_fingerprint").on(t.locationId, t.fingerprint), index("suggestions_open").on(t.locationId, t.status)],
);

// ---------- From the Google Business Profile ----------

/** Calls, clicks and views from Google, per day, for a Location with its profile linked. */
export const profileMetrics = seo.table(
  "profile_metrics",
  {
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    organizationId: org(),
    calls: integer("calls").notNull(),
    websiteClicks: integer("website_clicks").notNull(),
    directionRequests: integer("direction_requests").notNull(),
    impressionsMaps: integer("impressions_maps").notNull(),
    impressionsSearch: integer("impressions_search").notNull(),
  },
  (t) => [primaryKey({ columns: [t.locationId, t.day] })],
);

/** The searches that showed the profile, per month. Real searches: a source of keyword suggestions. */
export const profileSearchTerms = seo.table(
  "profile_search_terms",
  {
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    month: date("month").notNull(),
    term: text("term").notNull(),
    organizationId: org(),
    impressions: integer("impressions").notNull(),
  },
  (t) => [primaryKey({ columns: [t.locationId, t.month, t.term] })],
);
