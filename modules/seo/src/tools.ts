// What SEO offers a member's chat (ADR 0036): read tools over the same services the pages use, each trimmed to a
// summary a model can reason over. Each asks for SEO's `view` and SEO being on for the Organization. A tool works on
// one Location: the one named, else the one on the member's page (`?location=`), else the only one there is.
// Changes (tracking a keyword, applying a suggestion) come later, as tools that propose Tasks.
import { z } from "zod";
import { assertFeatureOn } from "@app/features";
import { AppError, defineTool, type AppContext, type Caller, type ToolCall } from "@app/kernel";
import { FEATURE } from "./access";
import { listLocations, type LocationView } from "./locations/service";
import { overview } from "./results/overview";
import { mapsKeyword, mapsSummary } from "./results/maps";
import { keywordsPage } from "./results/keywords";
import { aiPage } from "./results/ai";
import { channels, competitorsPage } from "./results/competitors";
import { listSuggestions } from "./suggestions/service";
import { auditIssue, auditPage } from "./audit/results";

const requires = { resource: "seo", action: "view" };

const location = z
  .string()
  .optional()
  .describe("The business: its name or id. Leave it out when the organization has one business, or the member is on its page.");

/** The Location a tool works on, or an error the model can pass on: none set up, or which one. */
async function locationFor(ctx: AppContext, caller: Caller, named: string | undefined, call: ToolCall): Promise<LocationView> {
  await assertFeatureOn(ctx, caller.orgId, FEATURE);
  const all = (await listLocations(ctx, caller.orgId)).filter((l) => l.status !== "archived");
  if (!all.length) throw new AppError(404, "no_location", "No business is set up yet. Setup starts from Search → Overview.");
  const want = (named ?? call.page?.params.location ?? "").trim().toLowerCase();
  if (want) {
    const found = all.find((l) => l.id === want) ?? all.find((l) => l.name.toLowerCase().includes(want));
    if (found) return found;
  }
  if (all.length === 1) return all[0]!;
  throw new AppError(422, "which_location", `Which business? This organization has ${all.length}: ${all.map((l) => l.name).join(", ")}.`, {
    locations: all.map((l) => ({ id: l.id, name: l.name })),
  });
}

const change = (now: number | null | undefined, before: number | null | undefined) =>
  now === null || now === undefined || before === null || before === undefined ? null : now - before;
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

export const listBusinesses = defineTool({
  name: "seo.list_locations",
  description: "The businesses (Locations) this organization tracks for SEO: name, city, whether checks run, and how often.",
  input: z.object({}),
  requires,
  effect: "read",
  run: async (ctx, caller) => {
    await assertFeatureOn(ctx, caller.orgId, FEATURE);
    return (await listLocations(ctx, caller.orgId))
      .filter((l) => l.status !== "archived")
      .map((l) => ({ id: l.id, name: l.name, city: l.city, status: l.status, checkEvery: l.checkEvery, website: l.website }));
  },
});

export const seoOverview = defineTool({
  name: "seo.overview",
  description:
    "Where a business stands now, with changes over 30 days: Google Maps (share of the map grid in the top 3), Google search (keywords on the first page), AI answers (how often assistants name it), competitors, open suggestions per channel, and its Google profile's calls, clicks and views. Start here for 'how am I doing?'.",
  input: z.object({ location }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const o = await overview(ctx, caller.orgId, l.id);
    return {
      business: { id: l.id, name: l.name, city: l.city },
      lastCheckedAt: o.lastCheckedAt,
      googleMaps: {
        top3Share: `${pct(o.maps.top3, o.maps.spots)}%`,
        top3Spots: o.maps.top3,
        spots: o.maps.spots,
        top3SpotsChange30d: change(o.maps.top3, o.maps.top3Before),
        keywords: o.maps.keywords,
      },
      googleSearch: {
        onFirstPage: o.keywords.firstPage,
        of: o.keywords.total,
        change30d: change(o.keywords.firstPage, o.keywords.firstPageBefore),
      },
      aiAnswers: { named: o.ai.named, of: o.ai.total, change30d: change(o.ai.named, o.ai.namedBefore), byAssistant: o.ai.byEngine },
      competitors: o.competitors,
      openSuggestions: o.openSuggestions,
      googleProfile: o.profile,
      usage: o.usage,
    };
  },
});

export const mapsRankings = defineTool({
  name: "seo.maps_rankings",
  description:
    "Google Maps rankings: for each Maps keyword, how many spots of the grid around the business show it in the top 3, its average position, the change over 30 days, and who is first. 'Top 3' is the map pack people see first.",
  input: z.object({ location }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const m = await mapsSummary(ctx, caller.orgId, l.id);
    return {
      business: l.name,
      keywords: m.keywords.map((k) =>
        k.pending
          ? { keyword: k.term, pending: true }
          : {
              keyword: k.term,
              top3Spots: `${k.top3} of ${k.size * k.size}`,
              change30d: change(k.top3, k.top3Before),
              averagePosition: k.avg,
              first: k.leader ? k.leader.name : "you",
            },
      ),
      totals: {
        top3Share: `${pct(m.totals.top3, m.totals.spots)}%`,
        top3SpotsChange30d: change(m.totals.top3, m.totals.top3Before),
        averagePosition: m.totals.avg,
        keywordsYouLead: m.totals.leading,
      },
    };
  },
});

export const mapsKeywordDetail = defineTool({
  name: "seo.maps_keyword",
  description:
    "One Google Maps keyword in depth: the businesses that rank for it around this business, best first, with their share of the top 3, average position, rating, reviews and main category. Use it for 'why are they ahead on X?'.",
  input: z.object({ location, keyword: z.string().min(1).describe("The Maps keyword, as tracked (e.g. 'dentist').") }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const summary = await mapsSummary(ctx, caller.orgId, l.id);
    const want = input.keyword.trim().toLowerCase();
    const k =
      summary.keywords.find((x) => x.term.toLowerCase() === want) ?? summary.keywords.find((x) => x.term.toLowerCase().includes(want));
    if (!k)
      throw new AppError(
        404,
        "not_tracked",
        `"${input.keyword}" isn't a tracked Maps keyword. Tracked: ${summary.keywords.map((x) => x.term).join(", ")}.`,
      );
    const d = await mapsKeyword(ctx, caller.orgId, l.id, k.id);
    return {
      keyword: k.term,
      board: d.board.slice(0, 10).map((b) => ({
        rank: b.rank,
        name: b.name,
        you: b.isYou,
        top3Spots: b.top3,
        averagePosition: b.avg,
        rating: b.rating,
        reviews: b.reviews,
        newReviewsPerMonth: b.newReviewsPerMonth,
        mainCategory: b.category,
        categories: b.categories,
      })),
      you: d.board.find((b) => b.isYou) ?? null,
    };
  },
});

export const searchRankings = defineTool({
  name: "seo.search_rankings",
  description:
    "Google search rankings: for each search keyword, searches a month, the business's position (null when not in the top 100), the change over 30 days, who is first, its ranking page, and whether the results showed a map pack or an AI Overview (and whether that cites the business).",
  input: z.object({ location }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const p = await keywordsPage(ctx, caller.orgId, l.id);
    return {
      business: l.name,
      onFirstPage: p.firstPage,
      onFirstPageChange30d: change(p.firstPage, p.firstPageBefore),
      keywords: p.keywords.map((k) =>
        k.pending
          ? { keyword: k.term, pending: true }
          : {
              keyword: k.term,
              searchesPerMonth: k.monthlySearches,
              position: k.position,
              change30d: k.before === undefined || k.before === null || k.position === null ? null : k.before - k.position,
              first: k.first ? (k.first.title ?? k.first.domain) : null,
              yourPage: k.url,
              mapPack: k.hasMapPack,
              aiOverview: k.hasAiOverview,
              aiOverviewCitesYou: k.aiOverviewCitesYou,
            },
      ),
    };
  },
});

export const aiAnswers = defineTool({
  name: "seo.ai_answers",
  description:
    "AI answers: for each tracked question, whether each assistant (ChatGPT, Google's AI Overview, Perplexity…) names the business and where, who else it names, and which sites it cites; plus the sites answers cite most, which are the places to be listed.",
  input: z.object({ location }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const p = await aiPage(ctx, caller.orgId, l.id);
    return {
      business: l.name,
      named: p.named,
      of: p.total,
      change30d: change(p.named, p.namedBefore),
      byAssistant: p.byEngine,
      mostCitedSites: p.topCites,
      questions: p.questions.map((q) => ({
        question: q.text,
        pending: q.pending,
        answers: Object.fromEntries(
          Object.entries(q.answers).map(([engine, a]) => [
            engine,
            a
              ? {
                  namesYou: a.namedYou,
                  position: a.position,
                  alsoNamed: a.named
                    .filter((n) => !n.isYou)
                    .map((n) => n.name)
                    .slice(0, 5),
                  cites: a.cites.slice(0, 5),
                }
              : null,
          ]),
        ),
      })),
    };
  },
});

export const competitors = defineTool({
  name: "seo.competitors",
  description:
    "Competitors on one channel (Google Maps, Google search or AI answers): who appears, and on how many keywords or questions they beat the business, the ones ahead first.",
  input: z.object({
    location,
    channel: z.enum(channels).default("maps").describe("maps: Google Maps; google: Google search; ai: AI answers."),
  }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const p = await competitorsPage(ctx, caller.orgId, l.id, input.channel);
    return {
      business: l.name,
      channel: input.channel,
      comparedOn: p.columns.length,
      competitors: p.rows.slice(0, 15).map((r) => ({
        name: r.name,
        kind: r.kind,
        website: r.domain,
        aheadOn: r.ahead,
        addedByHand: r.addedByYou,
      })),
    };
  },
});

export const suggestions = defineTool({
  name: "seo.suggestions",
  description:
    "The Action plan: what to do next for a business, best first. Each says what it would improve (maps, keywords, ai; a website fix can improve several), where it came from (audit: the site audit; profile: the Google profile; tracking: a keyword or question to track; listings: a site to get listed on), why, and what it was based on. Ones done by hand (website fixes, listings) are marked done rather than applied. Applying one is done on the page (Search → Actions → Action plan).",
  input: z.object({ location }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const { open } = await listSuggestions(ctx, caller.orgId, l.id);
    return {
      business: l.name,
      open: open.slice(0, 12).map((s) => ({
        kind: s.kind,
        improves: s.helpsAll,
        from: s.source,
        doneByHand: s.byHand,
        title: s.title,
        why: s.why,
        basedOn: s.evidence.slice(0, 3),
      })),
    };
  },
});

export const siteAudit = defineTool({
  name: "seo.site_audit",
  description:
    "The latest site audit of the business's website: its health out of 100 and the change since the audit before, and each kind of issue found, worst first, with its severity, how many pages (or services, or AI crawlers) it's on, which rankings it holds back, and whether its fix is in the Action plan. Use seo.site_audit_issue for how to fix one.",
  input: z.object({ location }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const p = await auditPage(ctx, caller.orgId, l.id);
    if (!p.audit) return { business: l.name, website: p.website, audited: false };
    return {
      business: l.name,
      website: p.audit.domain,
      auditedAt: p.audit.checkedAt,
      pagesCrawled: p.audit.pagesCrawled,
      health: p.audit.health,
      healthChange: p.audit.before ? p.audit.health - p.audit.before.health : null,
      issues: p.issues.map((i) => ({
        code: i.code,
        issue: i.title,
        severity: i.severity,
        found: i.count,
        per: i.per,
        about: i.items.slice(0, 6),
        holdsBack: i.helps,
        inActionPlan: i.fix?.state ?? null,
      })),
    };
  },
});

export const siteAuditIssue = defineTool({
  name: "seo.site_audit_issue",
  description:
    "One kind of site audit issue, by its code from seo.site_audit: why it matters, the steps to fix it and anything ready to paste (local business markup, robots.txt lines, an llms.txt), since when it's been found, and the pages it's on.",
  input: z.object({ location, code: z.string().min(2).describe("The issue's code, as seo.site_audit lists it (e.g. 'no_local_schema').") }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const d = await auditIssue(ctx, caller.orgId, l.id, input.code.trim());
    return {
      business: l.name,
      issue: d.title,
      severity: d.severity,
      why: d.why,
      found: d.found,
      steps: d.fix.steps,
      paste: d.fix.snippet,
      inActionPlan: d.planned?.state ?? null,
      pages: d.pages.slice(0, 20).map((p) => p.url),
    };
  },
});

export const seoTools = [
  listBusinesses,
  seoOverview,
  mapsRankings,
  mapsKeywordDetail,
  searchRankings,
  aiAnswers,
  competitors,
  suggestions,
  siteAudit,
  siteAuditIssue,
];
