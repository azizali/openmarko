import { and, desc, eq } from "drizzle-orm";
import { newId, notFound, type AppContext } from "@openmarko/kernel";
import { invoke } from "@openmarko/integrations";
import { aiAnswers, aiQuestions } from "./schema";
import { activeLocation } from "./locations";
import { listCompetitors } from "./rankings";

export async function listQuestions(ctx: AppContext, orgId: string, locationId: string) {
  await activeLocation(ctx, orgId, locationId);
  return ctx.db
    .select()
    .from(aiQuestions)
    .where(and(eq(aiQuestions.organizationId, orgId), eq(aiQuestions.locationId, locationId), eq(aiQuestions.active, true)));
}

export async function addQuestion(ctx: AppContext, orgId: string, locationId: string, text: string): Promise<string> {
  await activeLocation(ctx, orgId, locationId);
  const id = newId();
  await ctx.db.insert(aiQuestions).values({ id, organizationId: orgId, locationId, text: text.trim() }).onConflictDoNothing();
  return id;
}

/** Asks each AI assistant every question for the Location, and records who it recommends and whether we're among them. */
export async function checkAnswers(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  runId: string | null = null,
): Promise<{ answers: number; mentioned: number }> {
  const loc = await activeLocation(ctx, orgId, locationId);
  const names = [loc.name, ...(await listCompetitors(ctx, orgId, locationId)).map((c) => c.name)];
  const questions = await listQuestions(ctx, orgId, locationId);
  let mentioned = 0;
  for (const q of questions) {
    const { output } = await invoke<{ text: string; listed: string[] }>(
      ctx,
      orgId,
      "ai.visibility",
      { engine: "chatgpt", prompt: q.text, names },
      { runId },
    );
    const isListed = output.listed.includes(loc.name);
    if (isListed) mentioned++;
    await ctx.db.insert(aiAnswers).values({
      id: newId(),
      organizationId: orgId,
      questionId: q.id,
      engine: "chatgpt",
      listed: output.listed,
      mentioned: isListed,
      runId,
    });
  }
  return { answers: questions.length, mentioned };
}

export async function listAnswers(ctx: AppContext, orgId: string, questionId: string, limit = 50) {
  const [q] = await ctx.db
    .select()
    .from(aiQuestions)
    .where(and(eq(aiQuestions.id, questionId), eq(aiQuestions.organizationId, orgId)));
  if (!q) throw notFound("Question");
  return ctx.db.select().from(aiAnswers).where(eq(aiAnswers.questionId, questionId)).orderBy(desc(aiAnswers.checkedAt)).limit(limit);
}
