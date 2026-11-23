// The newest results for a Location, and the ones from about a month before: what every page and the suggestions
// read. Only active keywords and questions count. All reads are by Location id, which callers have already checked
// belongs to the Organization.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@app/kernel";
import { aiAnswers, aiCitations, aiMentions, keywords, mapScans, mapStandings, places, questions, serpItems, serpResults } from "../schema";

/** "About a month ago": the newest result at least this many days older than now. */
export const MONTH_AGO_DAYS = 28;

export type ScanRow = typeof mapScans.$inferSelect;

/** Per active keyword, its newest map scan; with `before`, the newest one at least a month old. */
export async function latestScans(db: Db, locationId: string, before = false): Promise<ScanRow[]> {
  const rows = await db.execute<{ id: string }>(sql`
    select distinct on (m.keyword_id) m.id
    from seo.map_scans m join seo.keywords k on k.id = m.keyword_id and k.active
    where m.location_id = ${locationId}
      ${before ? sql`and m.checked_at <= now() - interval '${sql.raw(String(MONTH_AGO_DAYS))} days'` : sql``}
    order by m.keyword_id, m.checked_at desc`);
  const ids = rows.rows.map((r) => r.id);
  return ids.length ? db.select().from(mapScans).where(inArray(mapScans.id, ids)) : [];
}

export type StandingRow = typeof mapStandings.$inferSelect & {
  name: string;
  domain: string | null;
  categories: string[];
  primaryCategory: string | null;
};

export async function standingsOf(db: Db, scanIds: string[]): Promise<StandingRow[]> {
  if (!scanIds.length) return [];
  return db
    .select({
      scanId: mapStandings.scanId,
      placeId: mapStandings.placeId,
      top3Spots: mapStandings.top3Spots,
      avgPosition: mapStandings.avgPosition,
      doorPosition: mapStandings.doorPosition,
      bestSide: mapStandings.bestSide,
      worstSide: mapStandings.worstSide,
      name: places.name,
      domain: places.domain,
      categories: places.categories,
      primaryCategory: places.primaryCategory,
    })
    .from(mapStandings)
    .innerJoin(places, eq(places.id, mapStandings.placeId))
    .where(inArray(mapStandings.scanId, scanIds));
}

export type SerpRow = typeof serpResults.$inferSelect;

/** Per active keyword, its newest Google search; with `before`, the newest at least a month old. */
export async function latestSerps(db: Db, locationId: string, before = false): Promise<SerpRow[]> {
  const rows = await db.execute<{ id: string }>(sql`
    select distinct on (r.keyword_id) r.id
    from seo.serp_results r join seo.keywords k on k.id = r.keyword_id and k.active
    where r.location_id = ${locationId}
      ${before ? sql`and r.checked_at <= now() - interval '${sql.raw(String(MONTH_AGO_DAYS))} days'` : sql``}
    order by r.keyword_id, r.checked_at desc`);
  const ids = rows.rows.map((r) => r.id);
  return ids.length ? db.select().from(serpResults).where(inArray(serpResults.id, ids)) : [];
}

export async function itemsOf(db: Db, resultIds: string[]) {
  if (!resultIds.length) return [];
  return db
    .select({
      resultId: serpItems.resultId,
      position: serpItems.position,
      domain: serpItems.domain,
      url: serpItems.url,
      title: serpItems.title,
      itemType: serpItems.itemType,
      placeId: serpItems.placeId,
      placeName: places.name,
    })
    .from(serpItems)
    .leftJoin(places, eq(places.id, serpItems.placeId))
    .where(inArray(serpItems.resultId, resultIds))
    .orderBy(serpItems.position);
}

export type AnswerRow = typeof aiAnswers.$inferSelect;

/** Per active question and engine, its newest answer; with `before`, the newest at least a month old. */
export async function latestAnswers(db: Db, locationId: string, before = false): Promise<AnswerRow[]> {
  const rows = await db.execute<{ id: string }>(sql`
    select distinct on (a.question_id, a.engine) a.id
    from seo.ai_answers a join seo.questions q on q.id = a.question_id and q.active
    where a.location_id = ${locationId}
      ${before ? sql`and a.checked_at <= now() - interval '${sql.raw(String(MONTH_AGO_DAYS))} days'` : sql``}
    order by a.question_id, a.engine, a.checked_at desc`);
  const ids = rows.rows.map((r) => r.id);
  return ids.length ? db.select().from(aiAnswers).where(inArray(aiAnswers.id, ids)) : [];
}

export async function mentionsOf(db: Db, answerIds: string[]) {
  if (!answerIds.length) return [];
  return db.select().from(aiMentions).where(inArray(aiMentions.answerId, answerIds)).orderBy(aiMentions.position);
}

export async function citationsOf(db: Db, answerIds: string[]) {
  if (!answerIds.length) return [];
  return db.select().from(aiCitations).where(inArray(aiCitations.answerId, answerIds)).orderBy(aiCitations.position);
}

/** The keywords a Location tracks; with `on`, only those searched there (Google Maps or Google search). */
export async function activeKeywords(db: Db, locationId: string, on?: "maps" | "organic") {
  return db
    .select({ id: keywords.id, term: keywords.term, metricId: keywords.metricId, createdAt: keywords.createdAt })
    .from(keywords)
    .where(and(eq(keywords.locationId, locationId), eq(keywords.active, true), on ? eq(keywords[on], true) : undefined))
    .orderBy(keywords.createdAt);
}

export async function activeQuestions(db: Db, locationId: string) {
  return db
    .select({ id: questions.id, text: questions.text, createdAt: questions.createdAt })
    .from(questions)
    .where(and(eq(questions.locationId, locationId), eq(questions.active, true)))
    .orderBy(questions.createdAt);
}

/** The time of the newest finished check of any kind, or null. */
export async function lastCheckedAt(db: Db, locationId: string): Promise<Date | null> {
  const rows = await db.execute<{ at: Date | null }>(sql`
    select max(finished_at) as at from seo.checks where location_id = ${locationId} and status = 'done'`);
  const at = rows.rows[0]?.at;
  return at ? new Date(at) : null;
}
