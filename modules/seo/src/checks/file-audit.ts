// Files a site audit: the crawl's facts become issues (audit/issues.ts), written once as the audit, its pages, its
// links between pages, and how many pages each kind of issue was found on, so the Site audit and its Key pages
// read small tables.

import { eq } from "drizzle-orm";
import type { Tx } from "@app/kernel";
import type { AuditResult } from "@app/integrations";
import { findIssues } from "../audit/issues";
import { auditIssues, auditLinks, auditPages, places, siteAudits } from "../schema";
import type { TaskTarget } from "./cycle";
import type { Filing } from "./filing";

type AuditTask = { target: Extract<TaskTarget, { kind: "audit" }>; result: AuditResult | null };

export async function fileAudit(tx: Tx, f: Filing, received: AuditTask[]): Promise<void> {
  const done = received.find((r) => r.result);
  if (!done?.result) return;
  const result = done.result;
  const l = f.location;
  // The phone the site should show is the one on the business's Google profile.
  const [own] = l.placeId ? await tx.select({ phone: places.phone }).from(places).where(eq(places.id, l.placeId)) : [];
  const found = findIssues(result, { phone: own?.phone ?? null, services: l.services });

  await tx.insert(siteAudits).values({
    checkId: f.checkId,
    organizationId: l.organizationId,
    locationId: l.id,
    domain: done.target.query.domain,
    checkedAt: f.checkedAt,
    pagesCrawled: result.pagesCrawled,
    health: found.health,
    homeUrl: result.site.homeUrl,
    schemaTypes: result.site.schemaTypes,
    phones: result.site.phones,
    blockedBots: found.blockedBots,
    llmsTxt: result.site.llmsTxt,
  });
  const pages = result.pages.map((p) => ({
    checkId: f.checkId,
    url: p.url,
    statusCode: p.statusCode,
    depth: p.depth,
    title: p.title,
    h1: p.h1,
    wordCount: p.wordCount,
    loadMs: p.loadMs === null ? null : Math.round(p.loadMs),
    issues: found.pageIssues.get(p.url) ?? [],
  }));
  // A site-wide finding sits on the home page, which a crawl may not have listed (a redirect to another address).
  if (found.pageIssues.has(result.site.homeUrl) && !pages.some((p) => p.url === result.site.homeUrl))
    pages.push({
      checkId: f.checkId,
      url: result.site.homeUrl,
      statusCode: 200,
      depth: 0,
      title: null,
      h1: null,
      wordCount: null,
      loadMs: null,
      issues: found.pageIssues.get(result.site.homeUrl)!,
    });
  // Same URL twice (a crawl's own quirk): the first wins.
  const unique = [...new Map(pages.toReversed().map((p) => [p.url, p])).values()];
  for (let i = 0; i < unique.length; i += 500) await tx.insert(auditPages).values(unique.slice(i, i + 500));
  // One row per pair of pages: the first anchor wins.
  const links = [...new Map((result.links ?? []).toReversed().map((x) => [`${x.from} ${x.to}`, x])).values()].map((x) => ({
    checkId: f.checkId,
    fromUrl: x.from,
    toUrl: x.to,
    anchor: x.anchor?.slice(0, 200) ?? null,
  }));
  for (let i = 0; i < links.length; i += 1000) await tx.insert(auditLinks).values(links.slice(i, i + 1000));
  if (found.findings.length)
    await tx.insert(auditIssues).values(found.findings.map((x) => ({ checkId: f.checkId, code: x.code, count: x.count, items: x.items })));
}
