// Gathers a check's results and files them. Runs when the provider says a task is ready (pingback), right after
// posting (the stub answers at once), and every minute for anything still waiting (the fallback, and how development
// works without a public address). A task that hasn't come back in three hours has failed.
//
// Filing happens once: the check is claimed (running → filing) before anything is written, so two collections that
// finish together can't file it twice. When every check of a Run is done, the Run finishes and suggestions are made.

import { and, eq, lt, sql } from "drizzle-orm";
import type { AppContext } from "@app/kernel";
import { finishRun } from "@app/automation";
import { invoke, type CollectOutput } from "@app/integrations";
import { generateSuggestions } from "../suggestions/generate";
import { checks, locations, providerTasks } from "../schema";
import { capabilityOf, type CheckKind, type TaskTarget } from "./cycle";
import { fileAi } from "./file-ai";
import { fileMaps } from "./file-maps";
import { fileOrganic } from "./file-organic";

const TIMEOUT_MS = 3 * 60 * 60_000;
const BATCH = 100;

/**
 * Asks the provider for a check's waiting tasks (or just one, by the provider's task id) and stores what came back.
 * Files the check when nothing is left waiting.
 */
export async function collectCheck(ctx: AppContext, checkId: string, onlyTask?: string): Promise<void> {
  const [check] = await ctx.db.select().from(checks).where(eq(checks.id, checkId));
  if (!check || check.status !== "running") return;
  const waiting = await ctx.db
    .select()
    .from(providerTasks)
    .where(
      and(
        eq(providerTasks.checkId, checkId),
        eq(providerTasks.status, "posted"),
        onlyTask ? sql`${providerTasks.externalTaskId} like ${`%${onlyTask}`}` : undefined,
      ),
    );
  for (let i = 0; i < waiting.length; i += BATCH) {
    const batch = waiting.slice(i, i + BATCH);
    const out = await invoke<CollectOutput<unknown>>(
      ctx,
      check.organizationId,
      capabilityOf[check.kind as CheckKind],
      { op: "collect", tasks: batch.map((t) => ({ externalId: t.externalTaskId, query: (t.target as TaskTarget).query })) },
      { runId: check.runId },
    ).catch(() => null);
    for (const c of out?.output.collected ?? []) {
      const task = batch.find((t) => t.externalTaskId === c.externalId)!;
      if (c.status === "ready")
        await ctx.db
          .update(providerTasks)
          .set({ status: "received", raw: c.result, receivedAt: new Date() })
          .where(eq(providerTasks.id, task.id));
      else if (c.status === "failed" || Date.now() - task.postedAt.getTime() > TIMEOUT_MS)
        await ctx.db
          .update(providerTasks)
          .set({ status: "failed", error: c.status === "failed" ? c.error : "No result after three hours." })
          .where(eq(providerTasks.id, task.id));
    }
  }
  const [left] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(providerTasks)
    .where(and(eq(providerTasks.checkId, checkId), eq(providerTasks.status, "posted")));
  if (!left?.n) await fileCheck(ctx, checkId);
}

/** Files a check whose tasks have all come back (or failed), once. */
export async function fileCheck(ctx: AppContext, checkId: string): Promise<void> {
  const [claimed] = await ctx.db
    .update(checks)
    .set({ status: "filing" })
    .where(and(eq(checks.id, checkId), eq(checks.status, "running")))
    .returning();
  if (!claimed) return;
  try {
    const [location] = await ctx.db.select().from(locations).where(eq(locations.id, claimed.locationId));
    const tasks = await ctx.db.select().from(providerTasks).where(eq(providerTasks.checkId, checkId));
    const received = tasks.filter((t) => t.status === "received").map((t) => ({ target: t.target as TaskTarget, result: t.raw as never }));
    const filing = { checkId, location: location!, checkedAt: claimed.queuedAt };
    await ctx.db.transaction(async (tx) => {
      if (claimed.kind === "maps") await fileMaps(tx, filing, received as never);
      else if (claimed.kind === "organic") await fileOrganic(tx, filing, received as never);
      else await fileAi(tx, filing, received as never);
      const failed = tasks.length - received.length;
      await tx
        .update(checks)
        .set({
          status: received.length || !tasks.length ? "done" : "failed",
          error: failed ? `${failed} of ${tasks.length} searches failed.` : null,
          finishedAt: new Date(),
        })
        .where(eq(checks.id, checkId));
    });
  } catch (err) {
    await ctx.db
      .update(checks)
      .set({ status: "failed", error: "Results could not be filed.", finishedAt: new Date() })
      .where(eq(checks.id, checkId));
    console.error(err);
  }
  await afterCheck(ctx, claimed.runId, claimed.organizationId, claimed.locationId);
}

/** When the last check of a Run is done: the Run finishes, and the Location gets its suggestions. */
async function afterCheck(ctx: AppContext, runId: string | null, orgId: string, locationId: string) {
  if (!runId) return;
  const states = await ctx.db.select({ status: checks.status, error: checks.error }).from(checks).where(eq(checks.runId, runId));
  if (states.some((s) => s.status === "running" || s.status === "filing")) return;
  const failed = states.filter((s) => s.status === "failed");
  await generateSuggestions(ctx, orgId, locationId, runId).catch((err) => console.error(err));
  await finishRun(ctx, runId, failed.length === states.length ? { error: failed[0]?.error ?? "Every check failed." } : {});
}

/** What the every-minute job collects: checks with tasks waiting a while, and checks left unfiled. */
export async function dueChecks(ctx: AppContext): Promise<string[]> {
  const waiting = await ctx.db
    .selectDistinct({ id: providerTasks.checkId })
    .from(providerTasks)
    .where(and(eq(providerTasks.status, "posted"), lt(providerTasks.postedAt, sql`now() - interval '45 seconds'`)))
    .limit(200);
  const stuck = await ctx.db
    .select({ id: checks.id })
    .from(checks)
    .where(
      and(
        eq(checks.status, "running"),
        lt(checks.queuedAt, sql`now() - interval '2 minutes'`),
        sql`not exists (select 1 from seo.provider_tasks t where t.check_id = "checks"."id" and t.status = 'posted')`,
      ),
    )
    .limit(200);
  return [...new Set([...waiting, ...stuck].map((r) => r.id))];
}

/** Keeps raw results 30 days: enough to re-read them after a parser fix. */
export async function pruneRaw(ctx: AppContext): Promise<void> {
  await ctx.db
    .update(providerTasks)
    .set({ raw: null })
    .where(and(lt(providerTasks.receivedAt, sql`now() - interval '30 days'`), sql`${providerTasks.raw} is not null`));
}
