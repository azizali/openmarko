// The AI answers page: per question and assistant, whether it named you and where, the opening of its answer, its
// list in order, and the sites it cited; how many answers name you now and a month ago, over the last 90 days; and
// the sites answers lean on most (being listed there is how a business gets named).

import { and, eq, gte, sql } from "drizzle-orm";
import type { AppContext } from "@app/kernel";
import { getLocation } from "../locations/service";
import { aiAnswers } from "../schema";
import { activeQuestions, citationsOf, latestAnswers, mentionsOf } from "./latest";
import { sum, weekly } from "./series";

export async function aiPage(ctx: AppContext, orgId: string, locationId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const [qs, now, before] = await Promise.all([
    activeQuestions(ctx.db, l.id),
    latestAnswers(ctx.db, l.id),
    latestAnswers(ctx.db, l.id, true),
  ]);
  const ids = now.map((a) => a.id);
  const [mentions, cites] = await Promise.all([mentionsOf(ctx.db, ids), citationsOf(ctx.db, ids)]);
  const engines = l.engines;
  const questions = qs.map((q) => {
    const answers = Object.fromEntries(
      engines.map((e) => {
        const a = now.find((x) => x.questionId === q.id && x.engine === e);
        if (!a) return [e, null];
        return [
          e,
          {
            namedYou: a.namedYou,
            position: a.yourPosition,
            excerpt: a.excerpt,
            named: mentions
              .filter((m) => m.answerId === a.id)
              .map((m) => ({ name: m.name, isYou: !!l.placeId && m.placeId === l.placeId })),
            cites: cites.filter((c) => c.answerId === a.id).map((c) => c.domain),
            checkedAt: a.checkedAt,
          },
        ];
      }),
    );
    return { id: q.id, text: q.text, pending: !now.some((a) => a.questionId === q.id), answers };
  });
  const counts = new Map<string, number>();
  for (const c of cites) counts.set(c.domain, (counts.get(c.domain) ?? 0) + 1);
  const history = await ctx.db
    .select({ at: aiAnswers.checkedAt, q: aiAnswers.questionId, engine: aiAnswers.engine, named: aiAnswers.namedYou })
    .from(aiAnswers)
    .where(and(eq(aiAnswers.locationId, l.id), gte(aiAnswers.checkedAt, sql`now() - interval '100 days'`)));
  const comparable = before.filter((b) => now.some((n) => n.questionId === b.questionId && n.engine === b.engine));
  return {
    engines,
    questions,
    named: now.filter((a) => a.namedYou).length,
    total: now.length,
    namedBefore: comparable.length ? comparable.filter((a) => a.namedYou).length : null,
    byEngine: engines.map((e) => ({
      engine: e,
      named: now.filter((a) => a.engine === e && a.namedYou).length,
      total: now.filter((a) => a.engine === e).length,
    })),
    topCites: [...counts]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    history: weekly(
      history.map((h) => ({ at: h.at, key: `${h.q}|${h.engine}`, value: h.named ? 1 : 0 })),
      sum,
    ),
  };
}
