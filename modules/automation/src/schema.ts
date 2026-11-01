import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, pgSchema, text, timestamp, uuid, uniqueIndex, bigint } from "drizzle-orm/pg-core";
import { authOrganization } from "@openmarko/kernel";

export const automation = pgSchema("automation");

/** When a job runs for an Organization (or one Location or Website). Ticked by the worker (ADR 0005). */
export const schedules = automation.table(
  "schedules",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    jobId: text("job_id").notNull(), // the job name, e.g. 'seo.profile-sync'
    targetType: text("target_type"), // 'location' | 'website' | null = whole Organization
    targetId: uuid("target_id"),
    every: text("every").notNull(), // 'hourly' | '6h' | 'daily' | '3d' | 'weekly' | 'monthly'
    at: text("at"), // 'HH:MM' (UTC) for daily and longer
    paused: boolean("paused").notNull().default(false),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("schedules_unique").on(t.organizationId, t.jobId, t.targetId),
    index("schedules_due")
      .on(t.nextRunAt)
      .where(sql`paused = false`),
  ],
);

/** One execution of a job, shown in Activity. Its cost is the sum of the usage it caused. */
export const runs = automation.table(
  "runs",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    trigger: text("trigger").notNull(), // 'scheduled' | 'manual' | 'event'
    status: text("status").notNull(), // 'queued' | 'running' | 'done' | 'failed' | 'canceled'
    progress: doublePrecision("progress").notNull().default(0),
    expectedSec: integer("expected_sec"),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    scheduleId: uuid("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    createdBy: text("created_by"),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    error: text("error"),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("runs_org_time").on(t.organizationId, t.queuedAt)],
);

/** Improvements, replies and fixes the assistant or a Member proposes. Apply and Undo work the same for all (ADR 0005). */
export const tasks = automation.table(
  "tasks",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'profile_edit', 'review_reply', 'site_fix'…
    featureId: text("feature_id").notNull(),
    action: text("action").notNull(), // the Action it needs, e.g. 'reviews.post'
    status: text("status").notNull(), // 'open' | 'applying' | 'applied' | 'dismissed' | 'failed' | 'reverted'
    title: text("title").notNull(),
    why: text("why"),
    impact: text("impact"), // 'high' | 'medium' | 'low'
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    preview: jsonb("preview").$type<{ label: string; before?: string; after: string } | null>(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    revert: jsonb("revert").$type<Record<string, unknown> | null>(),
    autopilot: boolean("autopilot").notNull().default(false),
    createdByType: text("created_by_type").notNull(), // 'member' | 'assistant' | 'system'
    createdBy: text("created_by"),
    appliedBy: text("applied_by"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("tasks_org_status").on(t.organizationId, t.status, t.createdAt),
    uniqueIndex("tasks_open_source")
      .on(t.organizationId, t.kind, t.sourceId)
      .where(sql`status = 'open' and source_id is not null`),
  ],
);
