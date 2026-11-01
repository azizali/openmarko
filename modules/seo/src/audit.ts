import { and, desc, eq } from "drizzle-orm";
import { newId, type AppContext } from "@openmarko/kernel";
import { invoke } from "@openmarko/integrations";
import { audits, auditIssues } from "./schema";
import { activeWebsite } from "./locations";

/** Crawls the whole domain (never a deep link) and stores the issues it finds. */
export async function runAudit(ctx: AppContext, orgId: string, websiteId: string, runId: string | null = null): Promise<string> {
  const site = await activeWebsite(ctx, orgId, websiteId);
  const { output } = await invoke<{
    pages: string[];
    issues: { rule: string; severity: "high" | "medium" | "low"; url: string; detail: string }[];
  }>(ctx, orgId, "site.crawl", { domain: site.domain }, { runId });
  const auditId = newId();
  await ctx.db.transaction(async (tx) => {
    await tx
      .insert(audits)
      .values({ id: auditId, organizationId: orgId, websiteId, status: "done", pagesCrawled: output.pages.length, runId });
    if (output.issues.length) {
      await tx.insert(auditIssues).values(output.issues.map((i) => Object.assign({}, i, { id: newId(), organizationId: orgId, auditId })));
    }
  });
  return auditId;
}

export async function listAudits(ctx: AppContext, orgId: string, websiteId: string, limit = 10) {
  await activeWebsite(ctx, orgId, websiteId);
  const rows = await ctx.db
    .select()
    .from(audits)
    .where(and(eq(audits.organizationId, orgId), eq(audits.websiteId, websiteId)))
    .orderBy(desc(audits.createdAt))
    .limit(limit);
  const out = [];
  for (const a of rows) {
    const issues = await ctx.db.select().from(auditIssues).where(eq(auditIssues.auditId, a.id));
    out.push({ ...a, issues });
  }
  return out;
}
