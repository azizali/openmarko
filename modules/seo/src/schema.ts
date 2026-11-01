import { sql } from "drizzle-orm";
import { boolean, date, doublePrecision, index, integer, jsonb, pgSchema, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { authOrganization } from "@openmarko/kernel";
import { locations, websites } from "@openmarko/organizations/schema";

export const seo = pgSchema("seo");

const orgRef = () =>
  text("organization_id")
    .notNull()
    .references(() => authOrganization.id, { onDelete: "cascade" });
const created = () =>
  timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`);

/** Business Profile insight per day, per Location. */
export const profileInsights = seo.table(
  "profile_insights",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    calls: integer("calls").notNull().default(0),
    directions: integer("directions").notNull().default(0),
    searches: integer("searches").notNull().default(0),
  },
  (t) => [uniqueIndex("profile_insights_day").on(t.locationId, t.day)],
);

/** Google reviews, as synced. `externalId` is Google's review name, needed to reply. */
export const reviews = seo.table(
  "reviews",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    rating: integer("rating").notNull(),
    text: text("text").notNull().default(""),
    author: text("author").notNull().default(""),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    firstSeenAt: created(),
  },
  (t) => [uniqueIndex("reviews_external").on(t.locationId, t.externalId), index("reviews_org_loc").on(t.organizationId, t.locationId)],
);

export const keywords = seo.table(
  "keywords",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
  },
  (t) => [uniqueIndex("keywords_loc_term").on(t.locationId, t.term)],
);

/** One rank check for one keyword. Grows with every scan: partitioned by month in the migration SQL. */
export const rankSnapshots = seo.table(
  "rank_snapshots",
  {
    id: uuid("id").notNull(),
    organizationId: orgRef(),
    keywordId: uuid("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    organicRank: integer("organic_rank"), // null = not in the top 10
    mapRank: integer("map_rank"), // null = not in the local pack
    topDomain: text("top_domain"),
    runId: uuid("run_id"),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("rank_snapshots_keyword").on(t.keywordId, t.checkedAt)],
);

export const competitors = seo.table(
  "competitors",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("competitors_loc_name").on(t.locationId, t.name)],
);

export const aiQuestions = seo.table(
  "ai_questions",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
  },
  (t) => [uniqueIndex("ai_questions_loc_text").on(t.locationId, t.text)],
);

export const aiAnswers = seo.table(
  "ai_answers",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => aiQuestions.id, { onDelete: "cascade" }),
    engine: text("engine").notNull(),
    listed: jsonb("listed").$type<string[]>().notNull(),
    mentioned: boolean("mentioned").notNull(),
    runId: uuid("run_id"),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ai_answers_question").on(t.questionId, t.checkedAt)],
);

export const audits = seo.table(
  "audits",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // 'done' | 'failed'
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    runId: uuid("run_id"),
    createdAt: created(),
  },
  (t) => [index("audits_website").on(t.websiteId, t.createdAt)],
);

export const auditIssues = seo.table(
  "audit_issues",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    rule: text("rule").notNull(),
    severity: text("severity").notNull(), // 'high' | 'medium' | 'low'
    url: text("url").notNull(),
    detail: text("detail").notNull(),
  },
  (t) => [index("audit_issues_audit").on(t.auditId)],
);

export const citations = seo.table(
  "citations",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    directory: text("directory").notNull(),
    status: text("status").notNull(), // 'found' | 'missing'
    url: text("url"),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("citations_loc_dir").on(t.locationId, t.directory)],
);

export const articles = seo.table(
  "articles",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull(), // 'draft' | 'published'
    publishedUrl: text("published_url"), // where the CMS put it, when it says
    externalId: text("external_id"), // the CMS's id for the post
    createdBy: text("created_by"),
    createdAt: created(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [index("articles_website").on(t.websiteId, t.status)],
);

/** One grid scan: a square of points around a Location, checked for one keyword. */
export const gridScans = seo.table("grid_scans", {
  id: uuid("id").primaryKey(),
  organizationId: orgRef(),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  size: integer("size").notNull(),
  stepKm: doublePrecision("step_km").notNull(),
  runId: uuid("run_id"),
  createdAt: created(),
});

export const gridPoints = seo.table(
  "grid_points",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => gridScans.id, { onDelete: "cascade" }),
    row: integer("row").notNull(),
    col: integer("col").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    rank: integer("rank"), // null = not in the local pack at this point
  },
  (t) => [index("grid_points_scan").on(t.scanId)],
);

/** A review request sent to a customer by email (metered: email.sent). */
export const reviewRequests = seo.table("review_requests", {
  id: uuid("id").primaryKey(),
  organizationId: orgRef(),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  status: text("status").notNull(), // 'sent'
  messageId: text("message_id"),
  createdBy: text("created_by"),
  createdAt: created(),
});

/** Sites that link to the website. `lostAt` is set when a link stops appearing. */
export const backlinks = seo.table(
  "backlinks",
  {
    id: uuid("id").primaryKey(),
    organizationId: orgRef(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    sourceDomain: text("source_domain").notNull(),
    url: text("url").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lostAt: timestamp("lost_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("backlinks_site_source").on(t.websiteId, t.sourceDomain)],
);
