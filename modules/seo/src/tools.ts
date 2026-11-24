// What SEO offers a member's chat (ADR 0036): read tools over the same services the pages use, each trimmed to a
// summary a model can reason over. Each asks for SEO's `view` and SEO being on for the Organization. A tool works on
// one Location: the one named, else the one on the member's page (`?location=`), else the only one there is.
// Changes (tracking a keyword or a question, applying a suggestion) are proposed as automation Tasks: Autopilot for
// the action, or a member, applies them, and they can be undone.
import { z } from "zod";
import { assertFeatureOn } from "@app/features";
import { AppError, conflict, defineTool, type AppContext, type Caller, type ToolCall } from "@app/kernel";
import { requireAllowed } from "@app/shared";
import { proposeTask } from "@app/automation";
import { FEATURE, SEO } from "./access";
import { normalizeQuestion, normalizeTerm } from "./lib/text";
import { listKeywords, listQuestions } from "./tracking/service";
import { listLocations, type LocationView } from "./locations/service";
import { overview } from "./results/overview";
import { mapsKeyword, mapsSummary } from "./results/maps";
import { keywordsPage } from "./results/keywords";
import { aiPage } from "./results/ai";
import { channels, competitorsPage } from "./results/competitors";
import { actionFor, listSuggestions, proposeSuggestion } from "./suggestions/service";
import { auditIssue, auditPage } from "./audit/results";
import { keyPagesView } from "./key-pages/service";
import { pathOf } from "./key-pages/logic";

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
    "The Action plan: what to do next for a business, best first. Each says what it would improve (maps, keywords, ai; a website fix can improve several), where it came from (audit: the site audit; profile: the Google profile; tracking: a keyword or question to track; listings: a site to get listed on), why, and what it was based on. Ones done by hand (website fixes, listings) are marked done rather than applied. seo.apply_suggestion applies one by its id.",
  input: z.object({ location }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const { open } = await listSuggestions(ctx, caller.orgId, l.id);
    return {
      business: l.name,
      open: open.slice(0, 12).map((s) => ({
        id: s.id,
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

export const keyPages = defineTool({
  name: "seo.key_pages",
  description:
    "The business's key pages (the pages of its website it most wants customers to land on, each for some tracked keywords), from the latest site audit's crawl: how many of the site's pages link to each, and the links to add to it (pages about its keywords that don't link there yet; an Action plan item with its id). Also the pages worth making key pages. Members choose key pages in Site audit → Key pages; adding links is done by hand on the site and marked done.",
  input: z.object({ location }),
  requires,
  effect: "read",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const p = await keyPagesView(ctx, caller.orgId, l.id);
    if (!p.audit)
      return {
        business: l.name,
        website: p.website,
        crawled: null,
        note: p.website ? "Not crawled yet: the site audit reads its pages and links." : "No website set.",
      };
    return {
      business: l.name,
      website: p.audit.domain,
      crawled: { at: p.audit.checkedAt, pages: p.audit.pagesCrawled, links: p.audit.links },
      linksRead: p.audit.links > 0,
      keyPages: p.keyPages.slice(0, 20).map((k) => ({
        page: k.path,
        title: k.title,
        foundInCrawl: !!k.url,
        keywords: k.keywords.map((kw) => kw.term),
        pagesLinkingToIt: k.linksIn,
        linksToAdd: k.toAdd ? { suggestionId: k.toAdd.id, linkWords: k.keyword, linkFrom: k.from.map((f) => pathOf(f.url)) } : null,
      })),
      suggestedKeyPages: p.ideas.map((i) => ({ page: i.path, title: i.title, forKeywords: i.keywords.map((k) => k.term) })),
    };
  },
});

// ---------- Changes, proposed as Tasks ----------

const tracks = { resource: "seo", action: "track" };
const waits =
  "It only proposes the change: unless Autopilot applies it at once (`applied: true`), it waits for a member to Apply it. Say which, and never call a proposal applied.";

/** Proposes a Task the assistant asked for in chat, on a Location. */
async function proposeFromChat(
  ctx: AppContext,
  caller: Caller,
  l: LocationView,
  t: { kind: string; title: string; label: string; after: string; payload: Record<string, unknown> },
) {
  const r = await proposeTask(ctx, {
    organizationId: caller.orgId,
    kind: t.kind,
    featureId: FEATURE,
    action: "seo.track",
    title: t.title,
    why: "Asked for in chat.",
    impact: "low",
    targetType: "seo_location",
    targetId: l.id,
    sourceType: "conversation",
    preview: { label: t.label, after: t.after },
    payload: { ...t.payload, locationId: l.id },
    createdByType: "assistant",
    createdBy: caller.userId,
  });
  return { taskId: r.id, applied: r.applied, title: t.title };
}

export const trackKeyword = defineTool({
  name: "seo.track_keyword",
  description: `Proposes tracking a keyword for a business on Google Maps and Google search; once applied it's checked straight away and in every check after. ${waits} The Plan limits how many keywords a business tracks.`,
  input: z.object({
    keyword: z.string().trim().min(2).max(80).describe("The search as people type it, e.g. 'emergency dentist austin'."),
    location,
  }),
  requires: tracks,
  effect: "propose",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const term = normalizeTerm(input.keyword);
    if ((await listKeywords(ctx, caller.orgId, l.id)).some((k) => k.term === term))
      throw conflict(`"${term}" is tracked already for ${l.name}.`);
    return proposeFromChat(ctx, caller, l, {
      kind: "seo.track_keyword",
      title: `Track "${term}" for ${l.name}`,
      label: "Keyword",
      after: term,
      payload: { term, monthlySearches: null },
    });
  },
});

export const trackQuestion = defineTool({
  name: "seo.track_question",
  description: `Proposes asking the AI assistants (ChatGPT, Google's AI Overview, Perplexity and others) a question for a business, to see whether they name it; once applied it's asked straight away and in every check after. ${waits} The Plan limits how many questions a business tracks.`,
  input: z.object({
    question: z
      .string()
      .trim()
      .min(8)
      .max(200)
      .describe("A question a customer would ask an assistant, e.g. 'Who is the best emergency dentist in Austin?'."),
    location,
  }),
  requires: tracks,
  effect: "propose",
  run: async (ctx, caller, input, call) => {
    const l = await locationFor(ctx, caller, input.location, call);
    const text = normalizeQuestion(input.question);
    if ((await listQuestions(ctx, caller.orgId, l.id)).some((q) => q.text.toLowerCase() === text.toLowerCase()))
      throw conflict(`"${text}" is asked already for ${l.name}.`);
    return proposeFromChat(ctx, caller, l, {
      kind: "seo.track_question",
      title: `Ask the AI assistants "${text}" for ${l.name}`,
      label: "Question",
      after: text,
      payload: { text },
    });
  },
});

export const applySuggestion = defineTool({
  name: "seo.apply_suggestion",
  description: `Proposes applying one suggestion from the Action plan, by its id from seo.suggestions: tracking a keyword or question, a change to the Google profile (needs it linked), or a post. ${waits} Undo is on the Action plan. Website fixes, links to add and listings are done by hand and can't be applied: give the member the steps (seo.site_audit_issue), and say they mark it done on Search → Actions → Action plan.`,
  input: z.object({ suggestion: z.uuid().describe("The suggestion's id, from seo.suggestions.") }),
  requires: tracks,
  effect: "propose",
  run: async (ctx, caller, input) => {
    await assertFeatureOn(ctx, caller.orgId, FEATURE);
    // A change to the Google profile, or a post, needs `publish` too.
    requireAllowed(caller, SEO, await actionFor(ctx, caller.orgId, input.suggestion));
    const r = await proposeSuggestion(
      ctx,
      { organizationId: caller.orgId, userId: caller.userId, actorType: "assistant" },
      input.suggestion,
    );
    return { taskId: r.id, applied: r.applied, title: r.title };
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
  keyPages,
  trackKeyword,
  trackQuestion,
  applySuggestion,
];
