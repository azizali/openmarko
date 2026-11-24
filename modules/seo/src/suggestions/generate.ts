// Writes a Location's suggestions after each check cycle. Every rule reads data the checks already gathered and
// says what it was based on (`evidence`); each suggestion has a fingerprint, so one that was applied, dismissed or
// made pointless never comes back. Rules, highest value first:
//   categories   competitors ahead of you on the map list categories your profile lacks        → profile_change
//   listing      AI answers keep citing a directory                                             → listing
//   keyword      what your profile is found for (Google) or a competitor's site ranks for     → track_keyword
//   description  your profile's description misses the services you track (profile linked)   → profile_change
//   question     Google's "People also ask" for your keywords                                  → track_question
//   post         you haven't posted on the profile in a month (profile linked)                 → post
//   site         the latest site audit's errors and warnings, one per kind of issue            → site_fix
// When the Organization's Autopilot is On for a suggestion's action, it's applied straight away, unless it's done by
// hand (a listing, a site fix): marking those done would claim work nobody did.
//
// A site fix's fingerprint names the audit where its issue's current streak began. While the issue keeps being found
// it's the same suggestion (refreshed with the latest counts while open); once an audit no longer finds it, an open
// one expires, and if the issue comes back later that's a new suggestion, even if the old one was marked done.

import { and, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import { newId, type AppContext } from "@app/kernel";
import { autopilotFor } from "@app/automation";
import { invoke, type KeywordIdea, type Profile } from "@app/integrations";
import { getLocation, type LocationRow } from "../locations/service";
import { readProfile } from "../profile/service";
import {
  activeKeywords,
  activeQuestions,
  citationsOf,
  latestAnswers,
  latestScans,
  latestSerps,
  mentionsOf,
  standingsOf,
} from "../results/latest";
import { normalizeQuestion, normalizeTerm } from "../lib/text";
import { auditIssues, auditPages, competitorOverrides, places, profileSearchTerms, suggestions, websites } from "../schema";
import { fixFor } from "../audit/fixes";
import { issueOf, issues, sortFindings, type IssueCode } from "../audit/issues";
import { fixFactsFor, latestAudits } from "../audit/results";
import { kindInfo, payloadSchemas, type Helps, type Payload, type SuggestionKind } from "./kinds";
import { applySuggestion } from "./service";

export type Draft<K extends SuggestionKind = SuggestionKind> = {
  kind: K;
  title: string;
  why: string;
  evidence: string[];
  payload: Payload<K>;
  fingerprint: string;
  score: number;
  /** The check it moves most, when the kind doesn't say (a site fix). */
  helps?: Helps;
  /** The check it came from (a site fix: the audit). */
  checkId?: string;
};

const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
const fmt = (n: number) => n.toLocaleString("en-US");

type Context = {
  l: LocationRow;
  yourDomain: string | null;
  yourCategories: string[];
  profile: Profile | null;
  rivals: { placeId: string; name: string; domain: string | null; categories: string[]; spots: number }[];
  trackedTerms: Set<string>;
  trackedQuestions: Set<string>;
};

async function gather(ctx: AppContext, orgId: string, locationId: string): Promise<Context> {
  const l = await getLocation(ctx, orgId, locationId);
  const [site] = l.websiteId ? await ctx.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, l.websiteId)) : [];
  const [own] = l.placeId ? await ctx.db.select({ categories: places.categories }).from(places).where(eq(places.id, l.placeId)) : [];
  const profile = await readProfile(ctx, l).catch(() => null);
  const hidden = new Set(
    (
      await ctx.db
        .select({ placeId: competitorOverrides.placeId })
        .from(competitorOverrides)
        .where(and(eq(competitorOverrides.locationId, l.id), eq(competitorOverrides.action, "hidden")))
    ).map((r) => r.placeId),
  );
  const standings = await standingsOf(
    ctx.db,
    (await latestScans(ctx.db, l.id)).map((s) => s.id),
  );
  const bySpots = new Map<string, Context["rivals"][number]>();
  for (const s of standings) {
    if (s.placeId === l.placeId || hidden.has(s.placeId)) continue;
    const r = bySpots.get(s.placeId) ?? { placeId: s.placeId, name: s.name, domain: s.domain, categories: s.categories, spots: 0 };
    r.spots += s.top3Spots;
    bySpots.set(s.placeId, r);
  }
  return {
    l,
    yourDomain: site?.domain ?? null,
    yourCategories: profile
      ? [profile.primaryCategory, ...profile.additionalCategories].filter((x): x is string => !!x)
      : (own?.categories ?? []),
    profile,
    rivals: [...bySpots.values()].filter((r) => r.spots > 0).sort((a, b) => b.spots - a.spots),
    trackedTerms: new Set((await activeKeywords(ctx.db, l.id)).map((k) => k.term)),
    trackedQuestions: new Set((await activeQuestions(ctx.db, l.id)).map((q) => q.text.toLowerCase())),
  };
}

// ---------- Rules ----------

function categoriesRule(c: Context): Draft<"profile_change">[] {
  const top = c.rivals.slice(0, 3);
  if (top.length < 2 || !c.yourCategories.length) return [];
  const mine = new Set(c.yourCategories.map((x) => x.toLowerCase()));
  const counts = new Map<string, string[]>();
  for (const r of top)
    for (const cat of r.categories) if (!mine.has(cat.toLowerCase())) counts.set(cat, [...(counts.get(cat) ?? []), r.name]);
  const missing = [...counts].filter(([, who]) => who.length >= 2).slice(0, 2);
  if (!missing.length) return [];
  const added = missing.map(([cat]) => cat);
  const after = [...c.yourCategories, ...added];
  return [
    {
      kind: "profile_change",
      title: added.length === 1 ? `Add “${added[0]}” to your Google profile` : `Add ${added.length} categories to your Google profile`,
      why: `The businesses ahead of you on the map list ${added.length === 1 ? "this category" : "these categories"} and you don't, so Google leaves you out of those searches.`,
      evidence: missing.map(([cat, who]) => `${list(who)} list “${cat}”.`),
      payload: { field: "categories", before: c.yourCategories, after },
      fingerprint: `profile_change:categories:${added
        .map((a) => a.toLowerCase())
        .sort()
        .join("|")}`,
      score: 90,
    },
  ];
}

async function listingRule(ctx: AppContext, c: Context): Promise<Draft<"listing">[]> {
  const answers = await latestAnswers(ctx.db, c.l.id);
  if (answers.length < 3) return [];
  const cites = await citationsOf(
    ctx.db,
    answers.map((a) => a.id),
  );
  const known = new Set([...c.rivals.map((r) => r.domain), c.yourDomain].filter(Boolean));
  const byDomain = new Map<string, Set<string>>();
  for (const x of cites) if (!known.has(x.domain)) byDomain.set(x.domain, new Set([...(byDomain.get(x.domain) ?? []), x.answerId]));
  const mentions = await mentionsOf(
    ctx.db,
    answers.map((a) => a.id),
  );
  return [...byDomain]
    .filter(([, ids]) => ids.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 2)
    .map(([domain, ids]) => {
      const named = [...new Set(mentions.filter((m) => ids.has(m.answerId) && m.placeId !== c.l.placeId).map((m) => m.name))].slice(0, 3);
      return {
        kind: "listing" as const,
        title: `Get listed on ${domain}`,
        why: "AI assistants lean on this site when they recommend businesses like yours. Being listed there is how a business gets named.",
        evidence: [
          `Cited in ${ids.size} of ${answers.length} AI answers.`,
          ...(named.length ? [`Those answers named ${list(named)}.`] : []),
        ],
        payload: { domain, citedIn: ids.size, answers: answers.length },
        fingerprint: `listing:${domain}`,
        score: 70 + ids.size,
      };
    });
}

async function keywordRule(ctx: AppContext, orgId: string, c: Context, runId: string | null): Promise<Draft<"track_keyword">[]> {
  const out: Draft<"track_keyword">[] = [];
  // What people searched to find the profile: real searches, from Google.
  const found = await ctx.db
    .select({ term: profileSearchTerms.term, impressions: profileSearchTerms.impressions })
    .from(profileSearchTerms)
    .where(and(eq(profileSearchTerms.locationId, c.l.id), gte(profileSearchTerms.month, sql`current_date - interval '62 days'`)))
    .orderBy(sql`${profileSearchTerms.impressions} desc`)
    .limit(20);
  const yourName = c.l.name.toLowerCase();
  for (const f of found) {
    const term = normalizeTerm(f.term);
    if (c.trackedTerms.has(term) || term.includes(yourName) || out.length >= 2) continue;
    out.push({
      kind: "track_keyword",
      title: `Track “${term}”`,
      why: "People already find your Google profile with this search. Tracking it shows whether you're climbing for it.",
      evidence: [`${fmt(f.impressions)} people saw your profile after searching this last month.`],
      payload: { term, monthlySearches: null },
      fingerprint: `track_keyword:${term}`,
      score: 60 + Math.min(20, f.impressions / 50),
    });
  }
  // What the strongest competitor's website ranks for, at most once a month (it costs a request).
  const [recent] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(suggestions)
    .where(
      and(
        eq(suggestions.locationId, c.l.id),
        eq(suggestions.kind, "track_keyword"),
        gte(suggestions.createdAt, sql`now() - interval '30 days'`),
      ),
    );
  const rival = c.rivals.find((r) => r.domain);
  if (!recent?.n && rival) {
    const ideas = await invoke<{ ideas: KeywordIdea[] }>(
      ctx,
      orgId,
      "search.keywords",
      { op: "ideas", domain: rival.domain, seeds: [], countryCode: c.l.countryCode, languageCode: c.l.languageCode, limit: 50 },
      { runId },
    ).catch(() => null);
    const local = (c.l.city ?? "").toLowerCase();
    for (const i of (ideas?.output.ideas ?? [])
      .filter((i) => (i.monthlySearches ?? 0) >= 50 && i.position !== null && i.position <= 20)
      .filter((i) => !local || i.term.toLowerCase().includes(local) || /near me/.test(i.term))
      .sort((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0))) {
      const term = normalizeTerm(i.term);
      if (c.trackedTerms.has(term) || out.some((o) => o.payload.term === term) || out.length >= 3) continue;
      out.push({
        kind: "track_keyword",
        title: `Track “${term}”`,
        why: `${rival.name} ranks for this and you don't track it.`,
        evidence: [`${fmt(i.monthlySearches ?? 0)} searches a month.`, `${rival.name}'s site is at ${i.position} on Google for it.`],
        payload: { term, monthlySearches: i.monthlySearches },
        fingerprint: `track_keyword:${term}`,
        score: 50 + Math.min(25, (i.monthlySearches ?? 0) / 200),
      });
    }
  }
  return out;
}

function descriptionRule(c: Context): Draft<"profile_change">[] {
  if (!c.profile) return [];
  const before = c.profile.description ?? "";
  const lower = before.toLowerCase();
  const missing = c.l.services.filter((s) => !lower.includes(s.toLowerCase())).slice(0, 4);
  if (before.length >= 250 && !missing.length) return [];
  const services = c.l.services.slice(0, 6);
  const category = (c.profile.primaryCategory ?? "business").toLowerCase();
  const after = [
    `${c.l.name} is a ${category}${c.l.city ? ` in ${c.l.city}` : ""}.`,
    services.length ? `We offer ${list(services.map((s) => s.toLowerCase()))}.` : "",
    c.profile.phone ? `Call ${c.profile.phone} or book online.` : "Book online or stop by.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 750);
  if (after.length < 20 || after === before) return [];
  return [
    {
      kind: "profile_change",
      title: before ? "Say what you offer in your description" : "Add a description to your Google profile",
      why: before
        ? "Your description doesn't name the services people search for."
        : "Your profile has no description, so Google has less to match searches with.",
      evidence: missing.length
        ? [`It doesn't mention ${list(missing.map((m) => `“${m}”`))}.`]
        : [`It's ${before.length} characters; Google allows 750.`],
      payload: { field: "description", before, after },
      fingerprint: `profile_change:description:${after.length}:${after.slice(0, 40).toLowerCase()}`,
      score: 55,
    },
  ];
}

async function questionRule(ctx: AppContext, c: Context): Promise<Draft<"track_question">[]> {
  const serps = await latestSerps(ctx.db, c.l.id);
  const seen = new Map<string, number>();
  for (const s of serps) for (const q of s.peopleAlsoAsk) seen.set(normalizeQuestion(q), (seen.get(normalizeQuestion(q)) ?? 0) + 1);
  return [...seen]
    .filter(([q]) => !c.trackedQuestions.has(q.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([text, n]) => ({
      kind: "track_question" as const,
      title: `Track “${text}”`,
      why: "People ask this on Google, so they ask AI assistants too. Tracking it shows whether they recommend you.",
      evidence: [`Google shows it under “People also ask” for ${n} of your keywords.`],
      payload: { text },
      fingerprint: `track_question:${text.toLowerCase()}`,
      score: 35 + n,
    }));
}

async function postRule(ctx: AppContext, c: Context): Promise<Draft<"post">[]> {
  if (!c.profile) return [];
  const [last] = await ctx.db
    .select({
      open: sql<number>`count(*) filter (where ${suggestions.status} = 'open')::int`,
      at: sql<Date | null>`max(${suggestions.decidedAt}) filter (where ${suggestions.status} = 'applied')`,
    })
    .from(suggestions)
    .where(and(eq(suggestions.locationId, c.l.id), eq(suggestions.kind, "post")));
  if (last?.open) return [];
  const lastAt = last?.at ? new Date(last.at) : null;
  if (lastAt && Date.now() - lastAt.getTime() < 28 * 86_400_000) return [];
  const service = c.l.services[0];
  const text = [
    service ? `Looking for ${service.toLowerCase()}${c.l.city ? ` in ${c.l.city}` : ""}?` : `Thank you for choosing ${c.l.name}.`,
    `${c.l.name} is here to help${c.l.services.length > 1 ? `, with ${list(c.l.services.slice(1, 4).map((s) => s.toLowerCase()))} too` : ""}.`,
    c.profile.phone ? `Call ${c.profile.phone} or book online.` : "Book online today.",
  ].join(" ");
  const week = Math.floor(Date.now() / (7 * 86_400_000));
  return [
    {
      kind: "post",
      title: service ? `Post about ${service.toLowerCase()}` : "Post an update on your Google profile",
      why: "Recent posts show on your profile and tell Google the business is active.",
      evidence: [
        lastAt
          ? `Your last post from here was ${Math.round((Date.now() - lastAt.getTime()) / (7 * 86_400_000))} weeks ago.`
          : "You haven't posted from here yet.",
      ],
      payload: { text },
      fingerprint: `post:${week}`,
      score: 30,
    },
  ];
}

/** The latest site audit's errors and warnings, one suggestion per kind of issue. Notices stay on the audit page. */
async function siteRule(ctx: AppContext, c: Context): Promise<Draft<"site_fix">[]> {
  const audits = await latestAudits(ctx.db, c.l.id);
  const now = audits[0];
  if (!now) return [];
  const all = await ctx.db
    .select()
    .from(auditIssues)
    .where(
      inArray(
        auditIssues.checkId,
        audits.map((a) => a.checkId),
      ),
    );
  const found = sortFindings(
    all
      .filter((f) => f.checkId === now.checkId && issueOf(f.code)?.severity !== "notice")
      .map((f) => ({ ...f, code: f.code as IssueCode })),
  );
  if (!found.length) return [];
  const facts = await fixFactsFor(ctx.db, c.l, now.homeUrl);
  const when = now.checkedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const drafts: Draft<"site_fix">[] = [];
  for (const f of found) {
    const info = issues[f.code];
    // Where this issue's streak began: the oldest audit in the unbroken run of audits that found it.
    let start = now.checkId;
    for (const a of audits) {
      if (!all.some((x) => x.checkId === a.checkId && x.code === f.code)) break;
      start = a.checkId;
    }
    const sample =
      info.per === "page"
        ? (
            await ctx.db
              .select({ url: auditPages.url })
              .from(auditPages)
              .where(and(eq(auditPages.checkId, now.checkId), sql`${f.code} = any(${auditPages.issues})`))
              .orderBy(auditPages.url)
              .limit(5)
          ).map((r) => r.url)
        : f.items.slice(0, 5);
    const fix = fixFor(f.code, f.items, facts);
    drafts.push({
      kind: "site_fix",
      title: info.todo(f.count),
      why: info.why,
      evidence: [
        info.per === "page"
          ? `Found on ${fmt(f.count)} ${f.count === 1 ? "page" : "pages"} of ${now.domain} in the audit of ${when}.`
          : `Found in the audit of ${now.domain} on ${when}.`,
        ...(info.per === "page" ? sample.slice(0, 3) : f.items.length ? [list(f.items.slice(0, 6))] : []),
      ],
      payload: { code: f.code, count: f.count, items: f.items, sample, helps: info.helps, steps: fix.steps, snippet: fix.snippet },
      fingerprint: `site_fix:${f.code}:${start}`,
      score: (info.severity === "error" ? 80 : 40) + Math.min(10, f.count),
      helps: info.helps[0],
      checkId: now.checkId,
    });
  }
  return drafts;
}

/** Open site fixes for issues the latest audit no longer found: fixed, so they leave the plan. */
async function expireFixed(ctx: AppContext, locationId: string): Promise<void> {
  const [now] = await latestAudits(ctx.db, locationId, 1);
  if (!now) return;
  const found = (await ctx.db.select({ code: auditIssues.code }).from(auditIssues).where(eq(auditIssues.checkId, now.checkId))).map(
    (r) => r.code,
  );
  await ctx.db
    .update(suggestions)
    .set({ status: "expired", decidedAt: new Date() })
    .where(
      and(
        eq(suggestions.locationId, locationId),
        eq(suggestions.kind, "site_fix"),
        eq(suggestions.status, "open"),
        found.length ? notInArray(sql<string>`${suggestions.payload}->>'code'`, found) : undefined,
      ),
    );
}

// ---------- Writing them ----------

/** Runs every rule for a Location and stores what's new. Returns how many were added. */
export async function generateSuggestions(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  runId: string | null = null,
): Promise<number> {
  const c = await gather(ctx, orgId, locationId);
  const drafts: Draft[] = [
    ...categoriesRule(c),
    ...(await listingRule(ctx, c)),
    ...(await keywordRule(ctx, orgId, c, runId)),
    ...descriptionRule(c),
    ...(await questionRule(ctx, c)),
    ...(await postRule(ctx, c)),
    ...(await siteRule(ctx, c)),
  ];
  await expireFixed(ctx, locationId);
  let added = 0;
  for (const d of drafts) {
    const payload = payloadSchemas[d.kind].parse(d.payload) as Record<string, unknown>;
    const id = newId();
    const [row] = await ctx.db
      .insert(suggestions)
      .values({
        id,
        organizationId: orgId,
        locationId,
        kind: d.kind,
        helps: d.helps ?? kindInfo[d.kind].helps,
        title: d.title,
        why: d.why,
        evidence: d.evidence,
        payload,
        fingerprint: d.fingerprint,
        status: "open",
        score: d.score,
        checkId: d.checkId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: suggestions.id });
    if (!row) {
      // Still found: an open site fix takes the latest counts, pages and fix.
      if (d.kind === "site_fix")
        await ctx.db
          .update(suggestions)
          .set({ title: d.title, evidence: d.evidence, payload, score: d.score, checkId: d.checkId ?? null })
          .where(and(eq(suggestions.locationId, locationId), eq(suggestions.fingerprint, d.fingerprint), eq(suggestions.status, "open")));
      continue;
    }
    added++;
    if (!kindInfo[d.kind].byHand && (await autopilotFor(ctx, orgId, `seo.${kindInfo[d.kind].action}`)) === "on")
      await applySuggestion(ctx, { organizationId: orgId, userId: null, actorType: "assistant" }, row.id).catch(() => undefined);
  }
  return added;
}
