// Acting on suggestions. Applying one proposes an automation Task and applies it at once (ADR 0005): the Task's
// executor (executors.ts) makes the change and keeps what Undo needs, and Activity records who did it. Undo reverts
// the Task and puts the suggestion back in the list. A post's text can be edited before it's applied.

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { conflict, invalid, notFound, type AppContext } from "@app/kernel";
import { applyTask, proposeTask, revertTask, type TaskActor } from "@app/automation";
import { FEATURE } from "../access";
import { getLocation } from "../locations/service";
import { suggestions } from "../schema";
import { kindInfo, payloadSchemas, type Helps, type Source, type SuggestionKind } from "./kinds";

export type SuggestionView = {
  id: string;
  kind: SuggestionKind;
  /** The check it should move most. */
  helps: string;
  /** Every check it should move: one, or for a site fix each one the issue holds back. */
  helpsAll: Helps[];
  source: Source;
  /** Done by hand: applying it marks it done. */
  byHand: boolean;
  title: string;
  why: string;
  evidence: string[];
  payload: Record<string, unknown>;
  status: string;
  needsProfile: boolean;
  createdAt: Date;
  decidedAt: Date | null;
};

/** Every check a suggestion should move: a site fix carries its own list. */
function helpsOf(s: typeof suggestions.$inferSelect): Helps[] {
  const own = (s.payload as { helps?: unknown }).helps;
  return s.kind === "site_fix" && Array.isArray(own) && own.length ? (own as Helps[]) : [s.helps as Helps];
}

const view = (s: typeof suggestions.$inferSelect): SuggestionView => ({
  id: s.id,
  kind: s.kind as SuggestionKind,
  helps: s.helps,
  helpsAll: helpsOf(s),
  source: kindInfo[s.kind as SuggestionKind].source,
  byHand: kindInfo[s.kind as SuggestionKind].byHand,
  title: s.title,
  why: s.why,
  evidence: s.evidence,
  payload: s.payload,
  status: s.status,
  needsProfile: kindInfo[s.kind as SuggestionKind].needsProfile,
  createdAt: s.createdAt,
  decidedAt: s.decidedAt,
});

/** Open suggestions, best first, and those applied in the last 30 days (the Done list, with Undo). */
export async function listSuggestions(ctx: AppContext, orgId: string, locationId: string) {
  await getLocation(ctx, orgId, locationId);
  const open = await ctx.db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.locationId, locationId), eq(suggestions.status, "open")))
    .orderBy(desc(suggestions.score), desc(suggestions.createdAt));
  const done = await ctx.db
    .select()
    .from(suggestions)
    .where(
      and(
        eq(suggestions.locationId, locationId),
        eq(suggestions.status, "applied"),
        gte(suggestions.decidedAt, sql`now() - interval '30 days'`),
      ),
    )
    .orderBy(desc(suggestions.decidedAt));
  return { open: open.map(view), done: done.map(view) };
}

async function load(ctx: AppContext, orgId: string, id: string) {
  const [s] = await ctx.db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.id, id), eq(suggestions.organizationId, orgId)));
  if (!s) throw notFound("Suggestion");
  return s;
}

/** The action applying a suggestion needs (`track` or `publish`): routes check it before calling apply. */
export async function actionFor(ctx: AppContext, orgId: string, id: string) {
  return kindInfo[(await load(ctx, orgId, id)).kind as SuggestionKind].action;
}

const shown = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v));

/** Applies a suggestion through an automation Task. `text` replaces a post's draft. */
export async function applySuggestion(ctx: AppContext, actor: TaskActor, id: string, edit?: { text?: string }): Promise<void> {
  const s = await load(ctx, actor.organizationId, id);
  if (s.status !== "open") throw conflict(`This suggestion is ${s.status}.`);
  const kind = s.kind as SuggestionKind;
  let payload = s.payload;
  if (edit?.text !== undefined) {
    if (kind !== "post") throw invalid("Only a post's text can be edited.");
    payload = payloadSchemas.post.parse({ text: edit.text.trim() });
    await ctx.db.update(suggestions).set({ payload }).where(eq(suggestions.id, s.id));
  }
  const info = kindInfo[kind];
  if (info.needsProfile) {
    const l = await getLocation(ctx, actor.organizationId, s.locationId);
    if (!l.gbpLocationName) throw conflict("Connect this location's Google profile to apply this.", { needs: "profile.manage" });
  }
  const change = kind === "profile_change" ? (payload as { field: string; before: unknown; after: unknown }) : null;
  const task = await proposeTask(ctx, {
    organizationId: actor.organizationId,
    kind: info.task,
    featureId: FEATURE,
    action: `seo.${info.action}`,
    title: s.title,
    why: s.why,
    targetType: "seo_location",
    targetId: s.locationId,
    sourceType: "seo_suggestion",
    sourceId: s.id,
    preview: change
      ? { label: change.field === "categories" ? "Categories" : "Description", before: shown(change.before), after: shown(change.after) }
      : null,
    payload: { ...payload, locationId: s.locationId, suggestionId: s.id },
    createdByType: actor.actorType,
    createdBy: actor.userId,
  });
  if (!task.applied) await applyTask(ctx, actor, task.id);
  await ctx.db
    .update(suggestions)
    .set({ status: "applied", taskId: task.id, decidedBy: actor.userId, decidedAt: new Date() })
    .where(eq(suggestions.id, s.id));
}

/** "Not now": it leaves the list and doesn't come back. */
export async function dismissSuggestion(ctx: AppContext, orgId: string, by: string | null, id: string): Promise<void> {
  const s = await load(ctx, orgId, id);
  if (s.status !== "open") throw conflict(`This suggestion is ${s.status}.`);
  await ctx.db.update(suggestions).set({ status: "dismissed", decidedBy: by, decidedAt: new Date() }).where(eq(suggestions.id, s.id));
}

/** Undo: reverts the change and puts the suggestion back in the list. */
export async function undoSuggestion(ctx: AppContext, actor: TaskActor, id: string): Promise<void> {
  const s = await load(ctx, actor.organizationId, id);
  if (s.status !== "applied" || !s.taskId) throw conflict("Only an applied suggestion can be undone.");
  await revertTask(ctx, actor, s.taskId);
  await ctx.db.update(suggestions).set({ status: "open", taskId: null, decidedBy: null, decidedAt: null }).where(eq(suggestions.id, s.id));
}

/** Open suggestions per check they'd move (a site fix counts for each), for the overview and the pages' headers. */
export async function openCounts(ctx: AppContext, locationId: string): Promise<Record<string, number>> {
  const rows = await ctx.db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.locationId, locationId), eq(suggestions.status, "open")));
  const counts: Record<string, number> = {};
  for (const s of rows) for (const h of helpsOf(s)) counts[h] = (counts[h] ?? 0) + 1;
  return counts;
}
