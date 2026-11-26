// A check cycle: everything a Location is checked for, at once. One automation Run per cycle (its cost is the sum of
// the provider calls it made), and one `checks` row per kind:
//   maps     every keyword, searched from every spot of the grid
//   organic  every keyword, on Google search from the business's door
//   ai       every question, asked of every chosen assistant
//   audit    the Location's website, crawled (one task). Weekly at most: a scheduled cycle includes it once the last
//            audit is AUDIT_EVERY_DAYS old; Check now on the Site audit page asks for it outright
// Queries are posted to the provider here; collect.ts gathers the results as they're ready and files them.
// A scope narrows a cycle to some keywords or questions: what was just added is checked at once. `kinds` narrows it to
// some kinds of check: Check now on the Google search page checks Google search only, unless asked for more.

import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { AppError, hmacHex, newId, type AppContext } from "@app/kernel";
import { finishRun, labelRun, startRun } from "@app/automation";
import {
  invoke,
  type AiEngine,
  type AiQuery,
  type AuditQuery,
  type MapsQuery,
  type OrganicQuery,
  type PostOutput,
  type Queue,
} from "@app/integrations";
import type { CapabilityId } from "@app/shared";
import { spotsOf, zoomFor } from "../lib/grid";
import { planLimits } from "../access";
import { getLocation, type LocationRow } from "../locations/service";
import { checks, keywords, providerTasks, questions, websites } from "../schema";

export type CheckKind = "maps" | "organic" | "ai" | "audit";
export const capabilityOf: Record<CheckKind, CapabilityId> = {
  maps: "search.maps",
  organic: "search.organic",
  ai: "search.ai",
  audit: "site.audit",
};
/** Every kind, in the order a cycle posts them. */
export const checkKinds: readonly CheckKind[] = ["maps", "organic", "ai", "audit"];

export const COLLECT_JOB = "seo.collect";

/** What a provider task was for: enough to file its result without reading anything else. */
export type TaskTarget =
  | { kind: "maps"; keywordId: string; idx: number; size: number; radiusM: number; center: { lat: number; lng: number }; query: MapsQuery }
  | { kind: "organic"; keywordId: string; query: OrganicQuery }
  | { kind: "ai"; questionId: string; engine: AiEngine; query: AiQuery }
  | { kind: "audit"; query: AuditQuery };

export type CycleScope = { keywordIds?: string[]; questionIds?: string[] };

export type CycleOptions = {
  queue: Queue;
  /** The Run this cycle belongs to (a schedule's); one is started when absent. */
  runId?: string | null;
  scope?: CycleScope;
  /** Only these kinds (Check now on one page); every kind when absent. */
  kinds?: readonly CheckKind[];
  trigger?: "scheduled" | "manual" | "event";
  by?: string | null;
};

/** Google Maps results read per spot: the first screen of the list. */
export const MAPS_DEPTH = 20;
/** Google search results read per keyword: ten pages, so a position past the first page is still known. */
export const ORGANIC_DEPTH = 100;
/** Pages a site audit crawls at most, unless the Plan's `seo_audit_pages` says fewer. */
export const AUDIT_PAGES = 500;
/** How often a scheduled cycle audits the website: a site changes more slowly than rankings. */
export const AUDIT_EVERY_DAYS = 7;

/** Where the provider says a task is ready. Only an address the provider can reach: none in development. */
export function pingbackUrl(ctx: AppContext, checkId: string): string | null {
  if (!ctx.cfg.authUrl.startsWith("https://")) return null;
  return `${ctx.cfg.authUrl}/api/v1/seo/checks/${checkId}/ready?task={id}&sig=${pingbackSignature(ctx, checkId)}`;
}
export const pingbackSignature = (ctx: AppContext, checkId: string) => hmacHex(ctx.cfg.authSecret, `seo-check:${checkId}`);

/** The queries one kind of check sends for a Location, each with what it's for. */
function targetsFor(
  kind: CheckKind,
  l: LocationRow,
  kws: { id: string; term: string; maps: boolean; organic: boolean }[],
  qs: { id: string; text: string }[],
  audit: AuditQuery | null,
): TaskTarget[] {
  const door = { lat: l.lat, lng: l.lng };
  if (kind === "audit") return audit ? [{ kind: "audit", query: audit }] : [];
  if (kind === "maps") {
    const spots = spotsOf(door, l.gridSize, l.gridRadiusM);
    const zoom = zoomFor(l.gridSize, l.gridRadiusM);
    return kws
      .filter((k) => k.maps)
      .flatMap((k) =>
        spots.map((s) => ({
          kind: "maps" as const,
          keywordId: k.id,
          idx: s.idx,
          size: l.gridSize,
          radiusM: l.gridRadiusM,
          center: door,
          query: { keyword: k.term, at: { lat: s.lat, lng: s.lng }, zoom, languageCode: l.languageCode, depth: MAPS_DEPTH },
        })),
      );
  }
  if (kind === "organic")
    return kws
      .filter((k) => k.organic)
      .map((k) => ({
        kind: "organic" as const,
        keywordId: k.id,
        query: { keyword: k.term, at: door, languageCode: l.languageCode, depth: ORGANIC_DEPTH },
      }));
  return qs.flatMap((q) =>
    (l.engines as AiEngine[]).map((engine) => ({
      kind: "ai" as const,
      questionId: q.id,
      engine,
      query: { engine, question: q.text, at: door, countryCode: l.countryCode, languageCode: l.languageCode },
    })),
  );
}

/** Posts one kind of check. Returns its id, or null when there's nothing to ask. */
async function postCheck(
  ctx: AppContext,
  l: LocationRow,
  kind: CheckKind,
  targets: TaskTarget[],
  runId: string,
  queue: Queue,
): Promise<string | null> {
  if (!targets.length) return null;
  const checkId = newId();
  await ctx.db
    .insert(checks)
    .values({ id: checkId, organizationId: l.organizationId, locationId: l.id, kind, status: "running", runId, queue });
  try {
    const out = await invoke<PostOutput<unknown>>(
      ctx,
      l.organizationId,
      capabilityOf[kind],
      { op: "post", queue, pingbackUrl: pingbackUrl(ctx, checkId), queries: targets.map((t, i) => ({ tag: String(i), query: t.query })) },
      { runId },
    );
    const rows = out.output.posted.map((p) => ({
      id: newId(),
      checkId,
      externalTaskId: p.externalId,
      target: targets[Number(p.tag)]! as unknown as Record<string, unknown>,
      status: p.result === undefined ? "posted" : "received",
      costMicros: p.costMicros,
      raw: p.result ?? null,
      receivedAt: p.result === undefined ? null : new Date(),
    }));
    for (let i = 0; i < rows.length; i += 500) await ctx.db.insert(providerTasks).values(rows.slice(i, i + 500));
    await ctx.db
      .update(checks)
      .set({ calls: rows.length, costMicros: rows.reduce((n, r) => n + r.costMicros, 0) })
      .where(eq(checks.id, checkId));
  } catch (err) {
    const message = err instanceof AppError ? err.message : "The search-data provider failed.";
    await ctx.db.update(checks).set({ status: "failed", error: message, finishedAt: new Date() }).where(eq(checks.id, checkId));
    if (!(err instanceof AppError)) console.error(err);
  }
  return checkId;
}

/** What an audit of the Location's website asks: its domain and the page budget. Null when it has no website. */
async function auditQuery(ctx: AppContext, l: LocationRow): Promise<AuditQuery | null> {
  if (!l.websiteId) return null;
  const [w] = await ctx.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, l.websiteId));
  if (!w) return null;
  const limit = (await planLimits(ctx, l.organizationId)).auditPages;
  return { domain: w.domain, maxPages: Math.max(1, Math.min(AUDIT_PAGES, limit ?? AUDIT_PAGES)) };
}

/** Whether a scheduled cycle should audit the site: no audit has run (or is running) in the last week. */
async function auditDue(ctx: AppContext, locationId: string): Promise<boolean> {
  const [recent] = await ctx.db
    .select({ id: checks.id })
    .from(checks)
    .where(
      and(
        eq(checks.locationId, locationId),
        eq(checks.kind, "audit"),
        ne(checks.status, "failed"),
        gte(checks.queuedAt, sql`now() - make_interval(days => ${AUDIT_EVERY_DAYS}::int)`),
      ),
    )
    .orderBy(desc(checks.queuedAt))
    .limit(1);
  return !recent;
}

/**
 * Starts a cycle for a Location: posts every kind of check and queues their first collection. Returns the Run and
 * the checks it made. A cycle with nothing to check finishes at once.
 */
export async function startCycle(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  opts: CycleOptions,
): Promise<{ runId: string; checkIds: string[] }> {
  const l = await getLocation(ctx, orgId, locationId);
  const label = `SEO check: ${l.name}`;
  const runId =
    opts.runId ??
    (await startRun(ctx, {
      organizationId: orgId,
      kind: "seo.check",
      label,
      trigger: opts.trigger ?? "manual",
      targetType: "seo_location",
      targetId: l.id,
      createdBy: opts.by ?? null,
    }));
  if (opts.runId) await labelRun(ctx, runId, label);

  const scope = opts.scope;
  const kws = await ctx.db
    .select({ id: keywords.id, term: keywords.term, maps: keywords.maps, organic: keywords.organic })
    .from(keywords)
    .where(
      and(eq(keywords.locationId, l.id), eq(keywords.active, true), scope?.keywordIds ? inArray(keywords.id, scope.keywordIds) : undefined),
    );
  const qs = await ctx.db
    .select({ id: questions.id, text: questions.text })
    .from(questions)
    .where(
      and(
        eq(questions.locationId, l.id),
        eq(questions.active, true),
        scope?.questionIds ? inArray(questions.id, scope.questionIds) : undefined,
      ),
    );
  // A scope names what to check; the other kind isn't checked at all, and the site isn't audited.
  const onlyQuestions = !!scope && !scope.keywordIds?.length;
  const onlyKeywords = !!scope && !scope.questionIds?.length;
  const audit = !scope && (opts.kinds ? opts.kinds.includes("audit") : await auditDue(ctx, l.id)) ? await auditQuery(ctx, l) : null;

  const checkIds: string[] = [];
  for (const kind of checkKinds) {
    if (kind === "audit" ? !!scope : (kind === "ai" && onlyKeywords) || (kind !== "ai" && onlyQuestions)) continue;
    if (opts.kinds && !opts.kinds.includes(kind)) continue;
    const id = await postCheck(ctx, l, kind, targetsFor(kind, l, kws, qs, audit), runId, opts.queue);
    if (id) checkIds.push(id);
  }
  if (!checkIds.length) {
    await finishRun(ctx, runId, {});
    return { runId, checkIds };
  }
  // Every check failed to post (no provider connected, say): nothing will come back, so the Run ends here.
  const posted = await ctx.db.select({ status: checks.status, error: checks.error }).from(checks).where(eq(checks.runId, runId));
  if (posted.every((c) => c.status === "failed")) {
    await finishRun(ctx, runId, { error: posted[0]?.error ?? "No check could be started." });
    return { runId, checkIds };
  }
  for (const checkId of checkIds) await ctx.enqueue?.(COLLECT_JOB, { checkId }, { organizationId: orgId });
  return { runId, checkIds };
}
