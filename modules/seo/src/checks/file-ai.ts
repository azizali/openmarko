// Files an AI answers check: per question and assistant, whether it named you and where in its list, the businesses
// it named (recognised among those seen nearby on the map, plus competitors added by hand), the sites it cited, and
// the opening of the answer.

import { and, eq, inArray, sql } from "drizzle-orm";
import { newId, type Tx } from "@app/kernel";
import type { AiResult } from "@app/integrations";
import { excerptOf, mentionsIn } from "../lib/text";
import { aiAnswers, aiCitations, aiMentions, competitorOverrides, places } from "../schema";
import type { TaskTarget } from "./cycle";
import type { Filing } from "./filing";

type AiTask = { target: Extract<TaskTarget, { kind: "ai" }>; result: AiResult | null };

/** The businesses an answer could name: everyone on the Location's recent maps, its additions, and itself. */
async function candidatesFor(tx: Tx, f: Filing): Promise<{ id: string; name: string }[]> {
  const seen = await tx.execute<{ id: string; name: string }>(sql`
    select distinct p.id, p.name from seo.map_standings s
    join seo.map_scans m on m.id = s.scan_id
    join seo.places p on p.id = s.place_id
    where m.location_id = ${f.location.id} and m.checked_at > now() - interval '120 days'`);
  const added = await tx
    .select({ id: places.id, name: places.name })
    .from(competitorOverrides)
    .innerJoin(places, eq(places.id, competitorOverrides.placeId))
    .where(and(eq(competitorOverrides.locationId, f.location.id), eq(competitorOverrides.action, "added")));
  const own = f.location.placeId
    ? await tx
        .select({ id: places.id, name: places.name })
        .from(places)
        .where(inArray(places.id, [f.location.placeId]))
    : [];
  const all = [...seen.rows, ...added, ...own, ...(own.length ? [] : [{ id: "", name: f.location.name }])];
  return [...new Map(all.map((c) => [c.id || c.name, c])).values()];
}

export async function fileAi(tx: Tx, f: Filing, tasks: AiTask[]): Promise<void> {
  const candidates = await candidatesFor(tx, f);
  const yourName = f.location.name.trim().toLowerCase();
  const isYou = (c: { id: string; name: string }) =>
    f.location.placeId ? c.id === f.location.placeId : c.name.trim().toLowerCase() === yourName;
  for (const t of tasks) {
    const text = t.result?.text ?? "";
    const named = mentionsIn(text, candidates);
    const at = named.findIndex(isYou);
    const answerId = newId();
    await tx.insert(aiAnswers).values({
      id: answerId,
      organizationId: f.location.organizationId,
      locationId: f.location.id,
      checkId: f.checkId,
      questionId: t.target.questionId,
      engine: t.target.engine,
      checkedAt: f.checkedAt,
      namedYou: at >= 0,
      yourPosition: at >= 0 ? at + 1 : null,
      excerpt: excerptOf(text) || "No answer.",
    });
    if (named.length)
      await tx
        .insert(aiMentions)
        .values(named.slice(0, 20).map((c, i) => ({ answerId, position: i + 1, name: c.name, placeId: c.id || null })));
    const cites = [...new Map((t.result?.citations ?? []).map((c) => [c.domain, c])).values()].slice(0, 20);
    if (cites.length)
      await tx.insert(aiCitations).values(cites.map((c, i) => ({ answerId, position: i + 1, domain: c.domain, url: c.url })));
  }
}
