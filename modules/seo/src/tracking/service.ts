// What a Location tracks: keywords (Maps and Google search), questions (AI answers) and the exceptions to the
// competitors found for it. Removing a keyword or question makes it inactive, so its history stays; adding it again
// brings the history back. New ones on an active Location are checked straight away, not at the next weekly check.

import { and, eq, inArray, sql } from "drizzle-orm";
import { conflict, invalid, logActivity, newId, notFound, planLimit, type AppContext } from "@app/kernel";
import type { PlaceCandidate } from "@app/integrations";
import { billingOf } from "@app/kernel";
import { limits } from "../access";
import { metricsFor } from "../catalog/keywords";
import { factsFromCandidate, upsertPlaces } from "../catalog/places";
import { normalizeQuestion, normalizeTerm } from "../lib/text";
import { getLocation } from "../locations/service";
import { competitorOverrides, keywordMetrics, keywords, places, questions, suggestions } from "../schema";

export type Source = "onboarding" | "suggestion" | "manual";

/** Throws plan_limit when `adding` more would pass the Plan's limit for this Location. */
async function assertRoom(ctx: AppContext, orgId: string, key: "keywords" | "questions", active: number, adding: number) {
  const ent = await billingOf(ctx).entitlementsFor(orgId);
  const limit = ent.get(`limit.${limits[key]}`);
  if (limit !== undefined && limit !== null && active + adding > limit) throw planLimit(`limit.${limits[key]}`);
}

/** Open suggestions to track something that's now tracked are no longer worth showing. */
async function expireSuggestionsFor(ctx: AppContext, locationId: string, fingerprints: string[]) {
  if (!fingerprints.length) return;
  await ctx.db
    .update(suggestions)
    .set({ status: "expired", decidedAt: new Date() })
    .where(and(eq(suggestions.locationId, locationId), eq(suggestions.status, "open"), inArray(suggestions.fingerprint, fingerprints)));
}

// ---------- Keywords ----------

export async function listKeywords(ctx: AppContext, orgId: string, locationId: string) {
  await getLocation(ctx, orgId, locationId);
  return ctx.db
    .select({
      id: keywords.id,
      term: keywords.term,
      source: keywords.source,
      monthlySearches: keywordMetrics.monthlySearches,
      createdAt: keywords.createdAt,
    })
    .from(keywords)
    .leftJoin(keywordMetrics, eq(keywordMetrics.id, keywords.metricId))
    .where(and(eq(keywords.locationId, locationId), eq(keywords.active, true)))
    .orderBy(keywords.createdAt);
}

/**
 * Tracks keywords for a Location. Ones already tracked are skipped; ones tracked before come back with their
 * history. Returns the ids of the keywords that are new or back.
 */
export async function addKeywords(
  ctx: AppContext,
  orgId: string,
  by: string | null,
  locationId: string,
  raw: string[],
  source: Source,
  runId: string | null = null,
): Promise<string[]> {
  const l = await getLocation(ctx, orgId, locationId);
  const terms = [...new Set(raw.map(normalizeTerm).filter((t) => t.length > 1 && t.length <= 80))];
  if (!terms.length) throw invalid("Type at least one keyword.");
  const existing = await ctx.db
    .select({ id: keywords.id, term: keywords.term, active: keywords.active })
    .from(keywords)
    .where(eq(keywords.locationId, l.id));
  const active = existing.filter((k) => k.active);
  const fresh = terms.filter((t) => !active.some((k) => k.term === t));
  if (!fresh.length) return [];
  await assertRoom(ctx, orgId, "keywords", active.length, fresh.length);

  const metrics = await metricsFor(ctx, orgId, fresh, l, runId);
  const ids: string[] = [];
  await ctx.db.transaction(async (tx) => {
    for (const term of fresh) {
      const before = existing.find((k) => k.term === term);
      if (before) {
        await tx.update(keywords).set({ active: true }).where(eq(keywords.id, before.id));
        ids.push(before.id);
      } else {
        const id = newId();
        await tx
          .insert(keywords)
          .values({ id, organizationId: orgId, locationId: l.id, term, metricId: metrics.get(term)?.id ?? null, source, createdBy: by });
        ids.push(id);
      }
    }
    await logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.track",
      resourceType: "seo_location",
      resourceId: l.id,
      summary: fresh.length === 1 ? `Tracking “${fresh[0]}”` : `Tracking ${fresh.length} keywords`,
    });
  });
  await expireSuggestionsFor(
    ctx,
    l.id,
    fresh.map((t) => `track_keyword:${t}`),
  );
  return ids;
}

export async function removeKeyword(ctx: AppContext, orgId: string, by: string | null, locationId: string, keywordId: string) {
  const res = await ctx.db
    .update(keywords)
    .set({ active: false })
    .where(and(eq(keywords.id, keywordId), eq(keywords.locationId, locationId), eq(keywords.organizationId, orgId)))
    .returning({ term: keywords.term });
  if (!res.length) throw notFound("Keyword");
  await ctx.db.transaction((tx) =>
    logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.track",
      resourceType: "seo_location",
      resourceId: locationId,
      summary: `Stopped tracking “${res[0]!.term}”`,
    }),
  );
}

// ---------- Questions ----------

export async function listQuestions(ctx: AppContext, orgId: string, locationId: string) {
  await getLocation(ctx, orgId, locationId);
  return ctx.db
    .select({ id: questions.id, text: questions.text, source: questions.source, createdAt: questions.createdAt })
    .from(questions)
    .where(and(eq(questions.locationId, locationId), eq(questions.active, true)))
    .orderBy(questions.createdAt);
}

export async function addQuestions(
  ctx: AppContext,
  orgId: string,
  by: string | null,
  locationId: string,
  raw: string[],
  source: Source,
): Promise<string[]> {
  const l = await getLocation(ctx, orgId, locationId);
  const texts = [...new Set(raw.map(normalizeQuestion).filter((t) => t.length > 8 && t.length <= 300))];
  if (!texts.length) throw invalid("Type at least one question, the way a customer would ask it.");
  const existing = await ctx.db
    .select({ id: questions.id, text: questions.text, active: questions.active })
    .from(questions)
    .where(eq(questions.locationId, l.id));
  const active = existing.filter((q) => q.active);
  const fresh = texts.filter((t) => !active.some((q) => q.text.toLowerCase() === t.toLowerCase()));
  if (!fresh.length) return [];
  await assertRoom(ctx, orgId, "questions", active.length, fresh.length);
  const ids: string[] = [];
  await ctx.db.transaction(async (tx) => {
    for (const text of fresh) {
      const before = existing.find((q) => q.text.toLowerCase() === text.toLowerCase());
      if (before) {
        await tx.update(questions).set({ active: true }).where(eq(questions.id, before.id));
        ids.push(before.id);
      } else {
        const id = newId();
        await tx.insert(questions).values({ id, organizationId: orgId, locationId: l.id, text, source, createdBy: by });
        ids.push(id);
      }
    }
    await logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.track",
      resourceType: "seo_location",
      resourceId: l.id,
      summary: fresh.length === 1 ? `Asking AI assistants “${fresh[0]}”` : `Asking AI assistants ${fresh.length} questions`,
    });
  });
  await expireSuggestionsFor(
    ctx,
    l.id,
    fresh.map((t) => `track_question:${t.toLowerCase()}`),
  );
  return ids;
}

export async function removeQuestion(ctx: AppContext, orgId: string, by: string | null, locationId: string, questionId: string) {
  const res = await ctx.db
    .update(questions)
    .set({ active: false })
    .where(and(eq(questions.id, questionId), eq(questions.locationId, locationId), eq(questions.organizationId, orgId)))
    .returning({ text: questions.text });
  if (!res.length) throw notFound("Question");
  await ctx.db.transaction((tx) =>
    logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.track",
      resourceType: "seo_location",
      resourceId: locationId,
      summary: `Stopped asking “${res[0]!.text}”`,
    }),
  );
}

// ---------- Competitor exceptions ----------

export async function listOverrides(ctx: AppContext, orgId: string, locationId: string) {
  await getLocation(ctx, orgId, locationId);
  return ctx.db
    .select({
      id: competitorOverrides.id,
      action: competitorOverrides.action,
      placeId: places.id,
      name: places.name,
      category: places.primaryCategory,
      address: places.address,
      createdAt: competitorOverrides.createdAt,
    })
    .from(competitorOverrides)
    .innerJoin(places, eq(places.id, competitorOverrides.placeId))
    .where(eq(competitorOverrides.locationId, locationId));
}

/** Adds a competitor found with a Maps search, or hides one that was found. One exception per business. */
export async function setOverride(
  ctx: AppContext,
  orgId: string,
  by: string | null,
  locationId: string,
  input: { action: "added"; place: PlaceCandidate } | { action: "hidden"; placeId: string },
): Promise<string> {
  const l = await getLocation(ctx, orgId, locationId);
  return ctx.db.transaction(async (tx) => {
    let placeId: string;
    let name: string;
    if (input.action === "added") {
      const ids = await upsertPlaces(tx, [factsFromCandidate(input.place)], "lookup");
      placeId = ids.get(input.place.placeId)!;
      name = input.place.name;
    } else {
      const [p] = await tx.select({ id: places.id, name: places.name }).from(places).where(eq(places.id, input.placeId));
      if (!p) throw notFound("Business");
      placeId = p.id;
      name = p.name;
    }
    if (placeId === l.placeId) throw conflict("That's this Location's own business.");
    const id = newId();
    const [row] = await tx
      .insert(competitorOverrides)
      .values({ id, organizationId: orgId, locationId: l.id, placeId, action: input.action, createdBy: by })
      .onConflictDoUpdate({
        target: [competitorOverrides.locationId, competitorOverrides.placeId],
        set: { action: sql`excluded.action`, createdBy: sql`excluded.created_by`, createdAt: sql`now()` },
      })
      .returning({ id: competitorOverrides.id });
    await logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.track",
      resourceType: "seo_location",
      resourceId: l.id,
      summary: input.action === "added" ? `Added ${name} as a competitor` : `Hid ${name} from competitors`,
    });
    return row!.id;
  });
}

export async function removeOverride(ctx: AppContext, orgId: string, locationId: string, overrideId: string) {
  const res = await ctx.db
    .delete(competitorOverrides)
    .where(
      and(
        eq(competitorOverrides.id, overrideId),
        eq(competitorOverrides.locationId, locationId),
        eq(competitorOverrides.organizationId, orgId),
      ),
    )
    .returning({ id: competitorOverrides.id });
  if (!res.length) throw notFound("Competitor");
}
