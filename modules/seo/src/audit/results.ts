// What the Site audit pages read (/seo/site-audit and /seo/site-audit/:code): the latest audit of a Location's
// website against the one before it, each kind of issue with its fix and where it stands in the Action plan, and the
// pages each issue was found on. Reads only: filing writes these tables (checks/file-audit.ts). Kept as services so
// the assistant's tools can read the same thing.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { notFound, type AppContext, type Db } from "@app/kernel";
import { getLocation, type LocationRow } from "../locations/service";
import { auditIssues, auditPages, places, siteAudits, suggestions, websites } from "../schema";
import { fixFor, type FixFacts } from "./fixes";
import { groupNames, issueOf, issues, sortFindings, type IssueCode, type IssueInfo } from "./issues";

/** The latest audits of a Location, newest first. */
export async function latestAudits(db: Db, locationId: string, n = 12) {
  return db.select().from(siteAudits).where(eq(siteAudits.locationId, locationId)).orderBy(desc(siteAudits.checkedAt)).limit(n);
}

async function issuesOf(db: Db, checkId: string) {
  return db.select().from(auditIssues).where(eq(auditIssues.checkId, checkId));
}

/** The business as a fix needs it: the Location, its Google profile's phone and category, and its site's address. */
export async function fixFactsFor(db: Db, l: LocationRow, homeUrl: string | null): Promise<FixFacts> {
  const [own] = l.placeId
    ? await db.select({ phone: places.phone, category: places.primaryCategory }).from(places).where(eq(places.id, l.placeId))
    : [];
  const [site] = l.websiteId ? await db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, l.websiteId)) : [];
  return {
    name: l.name,
    url: homeUrl ?? (site ? `https://${site.domain}/` : ""),
    address: l.address,
    phone: own?.phone ?? null,
    lat: l.lat,
    lng: l.lng,
    category: own?.category ?? l.categories[0] ?? null,
    services: l.services,
  };
}

/** Where each kind of issue stands in the Action plan: its newest site fix suggestion. */
async function plannedFixes(db: Db, locationId: string) {
  const rows = await db
    .select({
      id: suggestions.id,
      status: suggestions.status,
      code: sql<string>`${suggestions.payload}->>'code'`,
      decidedAt: suggestions.decidedAt,
    })
    .from(suggestions)
    .where(and(eq(suggestions.locationId, locationId), eq(suggestions.kind, "site_fix")))
    .orderBy(desc(suggestions.createdAt));
  const byCode = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!byCode.has(r.code)) byCode.set(r.code, r);
  return byCode;
}

export type FixState = "open" | "done" | "dismissed" | null;
const stateOf = (status: string | undefined): FixState =>
  status === "open" ? "open" : status === "applied" ? "done" : status === "dismissed" ? "dismissed" : null;

/** How many kinds of issue of one severity a crawl found. */
const tally = (severity: string, found: { code: string }[]) => found.filter((x) => issueOf(x.code)?.severity === severity).length;

/** The Site audit page: the latest audit, its issues worst first with their change since the audit before. */
export async function auditPage(ctx: AppContext, orgId: string, locationId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const [site] = l.websiteId ? await ctx.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, l.websiteId)) : [];
  const audits = await latestAudits(ctx.db, l.id);
  const [now, before] = audits;
  if (!now) return { website: site?.domain ?? null, audit: null, issues: [], history: [] };
  const [found, earlier, planned] = await Promise.all([
    issuesOf(ctx.db, now.checkId),
    before ? issuesOf(ctx.db, before.checkId) : Promise.resolve([]),
    plannedFixes(ctx.db, l.id),
  ]);
  const known = found.filter((f) => issueOf(f.code)).map((f) => ({ ...f, code: f.code as IssueCode }));
  const rows = sortFindings(known).map((f) => {
    const info: IssueInfo = issues[f.code];
    const was = earlier.find((e) => e.code === f.code);
    const fix = planned.get(f.code);
    return {
      code: f.code,
      title: info.title,
      group: info.group,
      groupName: groupNames[info.group],
      severity: info.severity,
      helps: info.helps,
      per: info.per,
      unit: info.unit ?? null,
      count: f.count,
      items: f.items,
      /** How many there were in the audit before; null when it wasn't found then (or there was none). */
      countBefore: before ? (was?.count ?? 0) : null,
      fix: fix ? { suggestionId: fix.id, state: stateOf(fix.status) } : null,
    };
  });
  return {
    website: site?.domain ?? now.domain,
    audit: {
      checkId: now.checkId,
      domain: now.domain,
      checkedAt: now.checkedAt,
      pagesCrawled: now.pagesCrawled,
      health: now.health,
      errors: tally("error", found),
      warnings: tally("warning", found),
      notices: tally("notice", found),
      before: before
        ? { checkedAt: before.checkedAt, health: before.health, errors: tally("error", earlier), warnings: tally("warning", earlier) }
        : null,
    },
    issues: rows,
    /** Health by audit, oldest first. */
    history: audits.toReversed().map((a) => ({ checkedAt: a.checkedAt, health: a.health })),
  };
}

/** One kind of issue in the latest audit: what it is, how to fix it, since when, and every page it's on. */
export async function auditIssue(ctx: AppContext, orgId: string, locationId: string, code: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const info = issueOf(code);
  if (!info) throw notFound("Issue");
  const audits = await latestAudits(ctx.db, l.id);
  const now = audits[0];
  if (!now) throw notFound("Audit");
  const all = await ctx.db
    .select({ checkId: auditIssues.checkId, count: auditIssues.count, items: auditIssues.items })
    .from(auditIssues)
    .where(
      and(
        eq(auditIssues.code, code),
        inArray(
          auditIssues.checkId,
          audits.map((a) => a.checkId),
        ),
      ),
    );
  const finding = all.find((f) => f.checkId === now.checkId) ?? null;
  // Found in every audit since this one: how long it's been there, as far back as the audits kept go.
  let since: Date | null = null;
  for (const a of audits) {
    if (!all.some((f) => f.checkId === a.checkId)) break;
    since = a.checkedAt;
  }
  const pages = await ctx.db
    .select({
      url: auditPages.url,
      statusCode: auditPages.statusCode,
      title: auditPages.title,
      depth: auditPages.depth,
      wordCount: auditPages.wordCount,
      loadMs: auditPages.loadMs,
    })
    .from(auditPages)
    .where(and(eq(auditPages.checkId, now.checkId), sql`${code} = any(${auditPages.issues})`))
    .orderBy(auditPages.url)
    .limit(500);
  const planned = (await plannedFixes(ctx.db, l.id)).get(code);
  const facts = await fixFactsFor(ctx.db, l, now.homeUrl);
  return {
    code,
    title: info.title,
    group: info.group,
    groupName: groupNames[info.group],
    severity: info.severity,
    helps: info.helps,
    why: info.why,
    per: info.per,
    unit: info.unit ?? null,
    itemsLabel: info.itemsLabel ?? null,
    checkedAt: now.checkedAt,
    domain: now.domain,
    /** Null when the latest audit didn't find it: fixed. */
    found: finding ? { count: finding.count, items: finding.items, since } : null,
    fix: fixFor(code as IssueCode, finding?.items ?? [], facts),
    planned: planned ? { suggestionId: planned.id, state: stateOf(planned.status), decidedAt: planned.decidedAt } : null,
    pages,
  };
}

/** The overview's line on the site: health, errors, and when it was audited. Null before the first audit. */
export async function auditSummary(ctx: AppContext, locationId: string) {
  const [now, before] = await latestAudits(ctx.db, locationId, 2);
  if (!now) return null;
  const found = await issuesOf(ctx.db, now.checkId);
  return {
    checkedAt: now.checkedAt,
    health: now.health,
    healthBefore: before?.health ?? null,
    errors: tally("error", found),
    warnings: tally("warning", found),
    pagesCrawled: now.pagesCrawled,
  };
}
