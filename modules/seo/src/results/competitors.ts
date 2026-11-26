// Competitors, per channel: who is ahead of you on the map, on Google search and in AI answers is worked out per
// keyword (or question) from results already gathered: no requests of their own. One row per competitor with how
// often they're ahead, and their result beside yours for every keyword. Hidden ones are left out; ones added by hand
// are kept even before they show up.

import { eq } from "drizzle-orm";
import type { AppContext } from "@app/kernel";
import { getLocation } from "../locations/service";
import { competitorOverrides, places } from "../schema";
import { activeKeywords, activeQuestions, itemsOf, latestAnswers, latestScans, latestSerps, mentionsOf, standingsOf } from "./latest";

export const channels = ["maps", "google", "ai"] as const;
export type Channel = (typeof channels)[number];

type Cell = { id: string; theirs: number | null; yours: number | null };
type Row = {
  id: string;
  name: string;
  kind: "business" | "directory";
  domain: string | null;
  addedByYou: boolean;
  ahead: number;
  cells: Cell[];
};

/** Is their result better? Lower is better on Google; higher everywhere else. */
export const isAhead = (channel: Channel, theirs: number | null, yours: number | null) =>
  theirs !== null && (channel === "google" ? yours === null || theirs < yours : theirs > (yours ?? 0));

export async function competitorsPage(ctx: AppContext, orgId: string, locationId: string, channel: Channel) {
  const l = await getLocation(ctx, orgId, locationId);
  const overrides = await ctx.db
    .select({
      id: competitorOverrides.id,
      action: competitorOverrides.action,
      placeId: places.id,
      name: places.name,
      domain: places.domain,
    })
    .from(competitorOverrides)
    .innerJoin(places, eq(places.id, competitorOverrides.placeId))
    .where(eq(competitorOverrides.locationId, l.id));
  const hidden = new Set(overrides.filter((o) => o.action === "hidden").map((o) => o.placeId));
  const added = overrides.filter((o) => o.action === "added");

  const rows = new Map<string, Row>();
  const row = (id: string, name: string, kind: Row["kind"], domain: string | null) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { id, name, kind, domain, addedByYou: added.some((a) => a.placeId === id), ahead: 0, cells: [] }));
    return r;
  };
  for (const a of added) row(a.placeId, a.name, "business", a.domain);

  let columns: { id: string; label: string }[] = [];
  const yours = new Map<string, number | null>();
  const theirs = new Map<string, Map<string, number | null>>(); // row id → column id → value
  const put = (rowId: string, col: string, v: number | null) => theirs.set(rowId, (theirs.get(rowId) ?? new Map()).set(col, v));

  if (channel === "maps") {
    const kws = await activeKeywords(ctx.db, l.id, "maps");
    const scans = await latestScans(ctx.db, l.id);
    columns = kws.filter((k) => scans.some((s) => s.keywordId === k.id)).map((k) => ({ id: k.id, label: k.term }));
    const st = await standingsOf(
      ctx.db,
      scans.map((s) => s.id),
    );
    for (const s of scans) yours.set(s.keywordId, s.yourTop3Spots);
    for (const s of st) {
      if (s.placeId === l.placeId || hidden.has(s.placeId)) continue;
      const kw = scans.find((x) => x.id === s.scanId)!.keywordId;
      row(s.placeId, s.name, "business", s.domain);
      put(s.placeId, kw, s.top3Spots);
    }
  } else if (channel === "google") {
    const kws = await activeKeywords(ctx.db, l.id, "organic");
    const serps = await latestSerps(ctx.db, l.id);
    columns = kws.filter((k) => serps.some((s) => s.keywordId === k.id)).map((k) => ({ id: k.id, label: k.term }));
    const items = await itemsOf(
      ctx.db,
      serps.map((s) => s.id),
    );
    for (const s of serps) yours.set(s.keywordId, s.yourPosition);
    for (const i of items) {
      if (
        (i.placeId && (i.placeId === l.placeId || hidden.has(i.placeId))) ||
        i.position === yours.get(serps.find((s) => s.id === i.resultId)!.keywordId)
      )
        continue;
      const kw = serps.find((s) => s.id === i.resultId)!.keywordId;
      const id = i.placeId ?? `domain:${i.domain}`;
      row(id, i.placeName ?? i.domain, i.itemType === "business" ? "business" : "directory", i.domain);
      put(id, kw, i.position);
    }
  } else {
    const qs = await activeQuestions(ctx.db, l.id);
    const answers = await latestAnswers(ctx.db, l.id);
    columns = qs.filter((q) => answers.some((a) => a.questionId === q.id)).map((q) => ({ id: q.id, label: q.text }));
    const mentions = await mentionsOf(
      ctx.db,
      answers.map((a) => a.id),
    );
    for (const q of columns) yours.set(q.id, answers.filter((a) => a.questionId === q.id && a.namedYou).length);
    for (const m of mentions) {
      if (
        (m.placeId && (m.placeId === l.placeId || hidden.has(m.placeId))) ||
        (!m.placeId && m.name.toLowerCase() === l.name.toLowerCase())
      )
        continue;
      const q = answers.find((a) => a.id === m.answerId)!.questionId;
      const id = m.placeId ?? `name:${m.name}`;
      row(id, m.name, "business", null);
      put(id, q, (theirs.get(id)?.get(q) ?? 0) + 1);
    }
  }

  const list = [...rows.values()].map((r) => {
    r.cells = columns.map((c) => ({
      id: c.id,
      theirs: theirs.get(r.id)?.get(c.id) ?? (channel === "google" ? null : 0),
      yours: yours.get(c.id) ?? null,
    }));
    r.ahead = r.cells.filter((c) => isAhead(channel, c.theirs, c.yours)).length;
    return r;
  });
  // Someone who never scores here isn't a competitor in this channel (unless you added them).
  const shown = list.filter((r) => r.addedByYou || r.cells.some((c) => (channel === "google" ? c.theirs !== null : (c.theirs ?? 0) > 0)));
  return {
    channel,
    columns,
    rows: shown.sort((a, b) => b.ahead - a.ahead || a.name.localeCompare(b.name)),
    hidden: overrides.filter((o) => o.action === "hidden").map((o) => ({ overrideId: o.id, placeId: o.placeId, name: o.name })),
    added: added.map((o) => ({ overrideId: o.id, placeId: o.placeId, name: o.name })),
  };
}

/** How many compete with you per channel, and who leads each: the overview's competitors card. */
export async function competitorCounts(ctx: AppContext, orgId: string, locationId: string) {
  const out: { channel: Channel; count: number; leader: string | null }[] = [];
  const everyone = new Set<string>();
  for (const c of channels) {
    const p = await competitorsPage(ctx, orgId, locationId, c);
    for (const r of p.rows) everyone.add(r.id);
    out.push({ channel: c, count: p.rows.length, leader: p.rows[0]?.ahead ? p.rows[0].name : null });
  }
  return { count: everyone.size, channels: out };
}
