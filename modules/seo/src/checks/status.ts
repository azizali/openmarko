// Where each kind of check stands for a Location: when it last finished, and whether one is under way (since when,
// and how many of its results are in). The SEO pages show it beside Check now, and Check now skips a kind that's
// already running.

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { automationSchema } from "@app/automation";
import type { AppContext } from "@app/kernel";
import { getLocation } from "../locations/service";
import { checks, keywords, questions } from "../schema";
import type { CheckKind } from "./cycle";

export const checkKinds: readonly CheckKind[] = ["maps", "organic", "ai"];

export type KindStatus = {
  kind: CheckKind;
  /** When this kind last finished with results. */
  lastCheckedAt: Date | null;
  /** The latest check of this kind failed: why. */
  lastError: string | null;
  running: { startedAt: Date; calls: number; received: number } | null;
};

export type CheckStatus = {
  kinds: KindStatus[];
  /** Every check is in but the cycle is still writing its suggestions. */
  finishing: boolean;
  /** What Check now would ask about. */
  keywords: number;
  /** Of those, the ones searched on Google Maps (each from every spot of the grid), and on Google search. */
  mapsKeywords: number;
  organicKeywords: number;
  questions: number;
};

export async function checkStatus(ctx: AppContext, orgId: string, locationId: string): Promise<CheckStatus> {
  await getLocation(ctx, orgId, locationId);
  const [last, latest, open, kw, qs] = await Promise.all([
    ctx.db
      .select({ kind: checks.kind, at: sql<Date | null>`max(${checks.finishedAt})` })
      .from(checks)
      .where(and(eq(checks.locationId, locationId), eq(checks.status, "done")))
      .groupBy(checks.kind),
    // The newest check of each kind: running, or how the last one ended.
    ctx.db
      .selectDistinctOn([checks.kind], {
        kind: checks.kind,
        status: checks.status,
        error: checks.error,
        queuedAt: checks.queuedAt,
        calls: checks.calls,
        received: sql<number>`(select count(*)::int from seo.provider_tasks t where t.check_id = "checks"."id" and t.status <> 'posted')`,
      })
      .from(checks)
      .where(eq(checks.locationId, locationId))
      .orderBy(checks.kind, sql`${checks.queuedAt} desc`),
    ctx.db
      .select({ n: sql<number>`count(*)::int` })
      .from(checks)
      .innerJoin(automationSchema.runs, eq(automationSchema.runs.id, checks.runId))
      .where(and(eq(checks.locationId, locationId), isNull(automationSchema.runs.finishedAt))),
    ctx.db
      .select({
        n: sql<number>`count(*)::int`,
        maps: sql<number>`count(*) filter (where ${keywords.maps})::int`,
        organic: sql<number>`count(*) filter (where ${keywords.organic})::int`,
      })
      .from(keywords)
      .where(and(eq(keywords.locationId, locationId), eq(keywords.active, true))),
    ctx.db
      .select({ n: sql<number>`count(*)::int` })
      .from(questions)
      .where(and(eq(questions.locationId, locationId), eq(questions.active, true))),
  ]);
  const kinds = checkKinds.map((kind): KindStatus => {
    const l = latest.find((r) => r.kind === kind);
    const at = last.find((r) => r.kind === kind)?.at;
    const busy = l && (l.status === "running" || l.status === "filing");
    return {
      kind,
      lastCheckedAt: at ? new Date(at) : null,
      lastError: l?.status === "failed" ? (l.error ?? "The check failed.") : null,
      running: busy ? { startedAt: l.queuedAt, calls: l.calls, received: l.received } : null,
    };
  });
  return {
    kinds,
    finishing: (open[0]?.n ?? 0) > 0 && kinds.every((k) => !k.running),
    keywords: kw[0]?.n ?? 0,
    mapsKeywords: kw[0]?.maps ?? 0,
    organicKeywords: kw[0]?.organic ?? 0,
    questions: qs[0]?.n ?? 0,
  };
}

/** The kinds asked for that aren't already under way: Check now never runs one kind twice at once. */
export async function idleKinds(ctx: AppContext, locationId: string, asked: readonly CheckKind[]): Promise<CheckKind[]> {
  const busy = await ctx.db
    .selectDistinct({ kind: checks.kind })
    .from(checks)
    .where(and(eq(checks.locationId, locationId), inArray(checks.status, ["running", "filing"])));
  return asked.filter((k) => !busy.some((b) => b.kind === k));
}
