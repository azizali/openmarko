// Key pages: what the Site audit's Key pages view reads, the facts the link rule makes suggestions from, and the
// writes that choose key pages. Reads the latest crawl (checks/file-audit.ts files it) and the keywords tracked on
// Google search, with the page Google shows for each. Kept as a service so the assistant's tools read the same thing.
// A write here doesn't refresh the links to add: the route does that after (suggestions/generate.ts).

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { invalid, newId, notFound, type AppContext, type Db } from "@app/kernel";
import { getLocation, type LocationRow } from "../locations/service";
import { auditLinks, auditPages, keyPageKeywords, keyPages, keywordMetrics, keywords, suggestions, websites } from "../schema";
import { latestAudits } from "../audit/results";
import { latestSerps } from "../results/latest";
import { listSuggestions } from "../suggestions/service";
import { keyPageLinks, pathOf, suggestKeyPages, type KeyPageLinks } from "./logic";

/** Ideas shown at once: the rest wait until these are taken or turned down. */
const IDEAS_SHOWN = 3;
/** Pages offered when adding a key page by hand, shallowest first. */
const PAGES_OFFERED = 1000;

/** The latest crawl's pages and links, the key pages, and the keywords tracked on Google search. Null before a crawl. */
async function read(db: Db, l: LocationRow) {
  const [audit] = await latestAudits(db, l.id, 1);
  if (!audit) return null;
  const [pages, links, tracked, serps, chosen, forPage] = await Promise.all([
    db
      .select({
        url: auditPages.url,
        statusCode: auditPages.statusCode,
        depth: auditPages.depth,
        title: auditPages.title,
        h1: auditPages.h1,
      })
      .from(auditPages)
      .where(eq(auditPages.checkId, audit.checkId)),
    db.select({ from: auditLinks.fromUrl, to: auditLinks.toUrl }).from(auditLinks).where(eq(auditLinks.checkId, audit.checkId)),
    db
      .select({ id: keywords.id, term: keywords.term, monthlySearches: keywordMetrics.monthlySearches })
      .from(keywords)
      .leftJoin(keywordMetrics, eq(keywordMetrics.id, keywords.metricId))
      .where(and(eq(keywords.locationId, l.id), eq(keywords.active, true), eq(keywords.organic, true))),
    latestSerps(db, l.id),
    db
      .select({ id: keyPages.id, path: keyPages.path, status: keyPages.status })
      .from(keyPages)
      .where(eq(keyPages.locationId, l.id))
      .orderBy(keyPages.createdAt),
    db
      .select({ keyPageId: keyPageKeywords.keyPageId, keywordId: keyPageKeywords.keywordId })
      .from(keyPageKeywords)
      .innerJoin(keyPages, eq(keyPages.id, keyPageKeywords.keyPageId))
      .where(eq(keyPages.locationId, l.id)),
  ]);
  const shown = new Map(serps.map((r) => [r.keywordId, r.yourUrl]));
  const byId = new Map(tracked.map((k) => [k.id, { ...k, monthlySearches: k.monthlySearches ?? null, yourUrl: shown.get(k.id) ?? null }]));
  const key = chosen
    .filter((k) => k.status === "key")
    .map((k) => ({
      id: k.id,
      path: k.path,
      keywords: forPage.filter((f) => f.keyPageId === k.id).flatMap((f) => byId.get(f.keywordId) ?? []),
    }));
  return { audit, pages, links, tracked: [...byId.values()], chosen, key };
}

/** Each key page with the pages that should link to it, from the latest crawl. Null when the site hasn't been crawled. */
export async function keyPageFacts(
  db: Db,
  l: LocationRow,
): Promise<{ audit: { checkId: string; domain: string; checkedAt: Date }; keyPages: KeyPageLinks[] } | null> {
  const r = await read(db, l);
  if (!r) return null;
  return {
    audit: { checkId: r.audit.checkId, domain: r.audit.domain, checkedAt: r.audit.checkedAt },
    keyPages: keyPageLinks({ pages: r.pages, links: r.links, keyPages: r.key, city: l.city }),
  };
}

/**
 * The Key pages view: the latest crawl (whether it read the site's links), each key page with its keywords, links in
 * and the links to add to it (its Action plan item, open or done), the pages worth making key pages, and what a member
 * picks from to add one by hand (the crawled pages, the tracked keywords).
 */
export async function keyPagesView(ctx: AppContext, orgId: string, locationId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const [site] = l.websiteId ? await ctx.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, l.websiteId)) : [];
  const r = await read(ctx.db, l);
  if (!r) return { website: site?.domain ?? null, audit: null, keyPages: [], ideas: [], moreIdeas: 0, pages: [], keywords: [] };
  const plan = await listSuggestions(ctx, orgId, l.id);
  const linksFor = (path: string, list: typeof plan.open) =>
    list.find((s) => s.kind === "add_link" && pathOf((s.payload as { to: string }).to) === path) ?? null;
  const found = keyPageLinks({ pages: r.pages, links: r.links, keyPages: r.key, city: l.city });
  const ideas = suggestKeyPages({
    pages: r.pages,
    keywords: r.tracked,
    taken: new Set(r.chosen.map((k) => k.path)),
    assigned: new Set(r.key.flatMap((k) => k.keywords.map((kw) => kw.id))),
    city: l.city,
  });
  const keyPageOf = new Map(r.key.flatMap((k) => k.keywords.map((kw) => [kw.id, k.id] as const)));
  return {
    website: site?.domain ?? r.audit.domain,
    audit: {
      domain: r.audit.domain,
      checkedAt: r.audit.checkedAt,
      pagesCrawled: r.audit.pagesCrawled,
      links: r.links.length,
    },
    keyPages: found.map((f) => {
      const k = r.key.find((x) => x.id === f.id)!;
      return {
        ...f,
        keywords: k.keywords.map((kw) => ({ id: kw.id, term: kw.term })),
        toAdd: linksFor(f.path, plan.open),
        done: linksFor(f.path, plan.done),
      };
    }),
    ideas: ideas.slice(0, IDEAS_SHOWN),
    moreIdeas: Math.max(0, ideas.length - IDEAS_SHOWN),
    pages: r.pages
      .filter((p) => p.statusCode >= 200 && p.statusCode < 300)
      .toSorted((a, b) => (a.depth ?? 9) - (b.depth ?? 9) || a.url.localeCompare(b.url))
      .slice(0, PAGES_OFFERED)
      .map((p) => ({ path: pathOf(p.url), title: p.h1 ?? p.title })),
    keywords: r.tracked
      .toSorted((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0))
      .map((k) => ({ id: k.id, term: k.term, keyPageId: keyPageOf.get(k.id) ?? null })),
  };
}

/**
 * Makes a page a key page for some tracked keywords, or changes which keywords one is for. A keyword is for one key
 * page at most, so naming it here moves it from another. A page turned down before becomes a key page.
 */
export async function setKeyPage(
  ctx: AppContext,
  orgId: string,
  by: string | null,
  locationId: string,
  input: { path: string; keywordIds: string[] },
): Promise<{ id: string }> {
  const l = await getLocation(ctx, orgId, locationId);
  const path = pathOf(input.path.trim());
  if (!path.startsWith("/")) throw invalid("Give the page's address on your website, like /services.");
  if (path === "/") throw invalid("The home page ranks for everything already: pick another page.");
  const ids = [...new Set(input.keywordIds)];
  if (ids.length) {
    const owned = await ctx.db
      .select({ id: keywords.id })
      .from(keywords)
      .where(and(eq(keywords.locationId, l.id), inArray(keywords.id, ids)));
    if (owned.length !== ids.length) throw invalid("Pick keywords this business tracks.");
  }
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(keyPages)
      .values({ id: newId(), organizationId: orgId, locationId: l.id, path, status: "key", createdBy: by })
      .onConflictDoUpdate({ target: [keyPages.locationId, keyPages.path], set: { status: "key" } })
      .returning({ id: keyPages.id });
    const id = row!.id;
    await tx
      .delete(keyPageKeywords)
      .where(and(eq(keyPageKeywords.keyPageId, id), ids.length ? notInArray(keyPageKeywords.keywordId, ids) : undefined));
    if (ids.length)
      await tx
        .insert(keyPageKeywords)
        .values(ids.map((keywordId) => ({ keywordId, keyPageId: id })))
        .onConflictDoUpdate({ target: keyPageKeywords.keywordId, set: { keyPageId: id } });
    return { id };
  });
}

/** Turns down a page suggested as a key page, so it isn't suggested again. */
export async function declineKeyPage(ctx: AppContext, orgId: string, by: string | null, locationId: string, rawPath: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const path = pathOf(rawPath.trim());
  await ctx.db
    .insert(keyPages)
    .values({ id: newId(), organizationId: orgId, locationId: l.id, path, status: "declined", createdBy: by })
    .onConflictDoNothing();
}

/** Stops a page being a key page: its keywords are free again, and its links to add leave the plan on the refresh. */
export async function removeKeyPage(ctx: AppContext, orgId: string, locationId: string, keyPageId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const [gone] = await ctx.db
    .delete(keyPages)
    .where(and(eq(keyPages.id, keyPageId), eq(keyPages.locationId, l.id)))
    .returning({ id: keyPages.id });
  if (!gone) throw notFound("Key page");
}

/** Open links to add whose links the latest crawl found, or whose key page is gone: they leave the plan. */
export async function expireAdded(db: Db, locationId: string, still: string[]): Promise<void> {
  await db
    .update(suggestions)
    .set({ status: "expired", decidedAt: new Date() })
    .where(
      and(
        eq(suggestions.locationId, locationId),
        eq(suggestions.kind, "add_link"),
        eq(suggestions.status, "open"),
        still.length ? notInArray(suggestions.fingerprint, still) : undefined,
      ),
    );
}

/** One Action plan item per key page and link words: marked done, it isn't suggested again for the same words. */
export const linkFingerprint = (k: { path: string; keyword: string }) => `add_link:${k.path}:${k.keyword}`;
