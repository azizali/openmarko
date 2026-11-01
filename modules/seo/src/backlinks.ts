import { and, eq, isNull } from "drizzle-orm";
import { newId, type AppContext } from "@openmarko/kernel";
import { invoke } from "@openmarko/integrations";
import { backlinks } from "./schema";
import { activeWebsite } from "./locations";

/**
 * Refreshes the referring domains of a website. New links are added; links that stop appearing are marked
 * lost (kept, so the history stays). Returns how many are new and how many were lost.
 */
export async function checkBacklinks(
  ctx: AppContext,
  orgId: string,
  websiteId: string,
  runId: string | null = null,
): Promise<{ added: number; lost: number }> {
  const site = await activeWebsite(ctx, orgId, websiteId);
  const { output } = await invoke<{ domain: string; url: string }[]>(ctx, orgId, "backlinks.read", { domain: site.domain }, { runId });
  const now = new Date();
  const seen = new Set(output.map((o) => o.domain));
  let added = 0;
  for (const o of output) {
    const [row] = await ctx.db
      .select()
      .from(backlinks)
      .where(and(eq(backlinks.websiteId, websiteId), eq(backlinks.sourceDomain, o.domain)));
    if (row) {
      await ctx.db.update(backlinks).set({ lastSeenAt: now, lostAt: null, url: o.url }).where(eq(backlinks.id, row.id));
    } else {
      await ctx.db.insert(backlinks).values({ id: newId(), organizationId: orgId, websiteId, sourceDomain: o.domain, url: o.url });
      added++;
    }
  }
  const current = await ctx.db
    .select()
    .from(backlinks)
    .where(and(eq(backlinks.websiteId, websiteId), isNull(backlinks.lostAt)));
  let lost = 0;
  for (const b of current) {
    if (!seen.has(b.sourceDomain)) {
      await ctx.db.update(backlinks).set({ lostAt: now }).where(eq(backlinks.id, b.id));
      lost++;
    }
  }
  return { added, lost };
}

export async function listBacklinks(ctx: AppContext, orgId: string, websiteId: string) {
  return ctx.db
    .select()
    .from(backlinks)
    .where(and(eq(backlinks.organizationId, orgId), eq(backlinks.websiteId, websiteId)));
}
