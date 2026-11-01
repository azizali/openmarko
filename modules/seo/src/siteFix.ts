import { and, eq } from "drizzle-orm";
import { AppError, invalid, notFound, type AppContext } from "@openmarko/kernel";
import { invoke, siteSupports, type SiteOp } from "@openmarko/integrations";
import { proposeTask } from "@openmarko/automation";
import { auditIssues, audits } from "./schema";
import { activeWebsite } from "./locations";

type FixOp = Extract<SiteOp, "setTitle" | "setMetaDescription">;

/** Which CMS-contract op fixes which audit rule (ADR 0016). Rules not listed can't be fixed automatically yet. */
const fixes: Record<string, { op: FixOp; ask: (url: string) => string }> = {
  "title.missing": { op: "setTitle", ask: (url) => `Write a title tag of at most 60 characters for ${url}. Reply with the title only.` },
  "meta.description.long": {
    op: "setMetaDescription",
    ask: (url) => `Write a meta description of at most 155 characters for ${url}. Reply with the description only.`,
  },
};

/**
 * Turns an audit issue into a site_fix Task. The new text is drafted now; nothing changes until it's applied.
 * If the website's CMS is connected but can't make this change, it says so now rather than when applied.
 */
export async function proposeSiteFix(ctx: AppContext, orgId: string, issueId: string, userId: string | null) {
  const [row] = await ctx.db
    .select({ issue: auditIssues, websiteId: audits.websiteId })
    .from(auditIssues)
    .innerJoin(audits, eq(audits.id, auditIssues.auditId))
    .where(and(eq(auditIssues.id, issueId), eq(auditIssues.organizationId, orgId)));
  if (!row) throw notFound("Issue");
  const fix = fixes[row.issue.rule];
  if (!fix) throw invalid(`There's no automatic fix for ${row.issue.rule} yet.`);
  const site = await activeWebsite(ctx, orgId, row.websiteId);
  if ((await siteSupports(ctx, orgId, site.id, fix.op)) === false) {
    throw new AppError(409, "unsupported_by_cms", `This website's CMS can't ${fix.op} through its connection.`, { op: fix.op });
  }
  const { output } = await invoke<{ text: string }>(ctx, orgId, "llm.complete", { prompt: fix.ask(row.issue.url) });
  const value = output.text.trim();
  return proposeTask(ctx, {
    organizationId: orgId,
    kind: "site_fix",
    featureId: "site_health",
    action: "site_health.fix",
    title: `Fix: ${row.issue.detail}`,
    why: row.issue.url,
    impact: row.issue.severity as "high" | "medium" | "low",
    targetType: "website",
    targetId: site.id,
    sourceType: "audit_issue",
    sourceId: row.issue.id,
    preview: { label: fix.op, after: value },
    payload: { websiteId: site.id, url: row.issue.url, op: fix.op, value },
    createdByType: userId ? "member" : "assistant",
    createdBy: userId,
  });
}
