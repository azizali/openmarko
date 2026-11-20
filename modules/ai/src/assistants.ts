// Assistants: a model, instructions and the knowledge bases it answers from, owned by an Organization. Each turn,
// the app searches the assistant's bases for the member's message and gives the model what it found, numbered,
// beside the instructions; the answer keeps those passages as its sources. That works with every model, tool
// calling or not. Without the knowledge module, an assistant is its model and instructions.
import { and, desc, eq } from "drizzle-orm";
import { invalid, knowledgeOf, newId, notFound, type AppContext, type KnowledgeHit } from "@app/kernel";
import { assistants } from "./schema";

export type Assistant = typeof assistants.$inferSelect;
export type WidgetSettings = { enabled: boolean; allowedOrigins: string[]; greeting: string; accent: string };
export type AssistantInput = {
  name: string;
  instructions?: string;
  model?: string | null;
  knowledgeBaseIds?: string[];
  widget?: Partial<WidgetSettings>;
};

/** Widget settings, checked: real origins (https, or http on this machine), a short greeting, a hex colour. */
function checkWidget(current: WidgetSettings, w: Partial<WidgetSettings>): WidgetSettings {
  const next = { ...current, ...w };
  for (const o of next.allowedOrigins) {
    let ok = false;
    try {
      const u = new URL(o);
      ok = u.origin === o && (u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1");
    } catch {
      ok = false;
    }
    if (!ok) throw invalid(`"${o}" isn't a website origin (https://example.com, no path).`);
  }
  if (next.enabled && next.allowedOrigins.length === 0)
    throw invalid(
      "Add at least one website the widget may answer on before turning it on, e.g. https://example.com or http://localhost:5174.",
    );
  if (next.greeting.length > 200) throw invalid("The greeting is at most 200 characters.");
  if (!/^#[0-9a-fA-F]{6}$/.test(next.accent)) throw invalid("The colour is a hex colour, e.g. #1d4ed8.");
  return { ...next, allowedOrigins: [...new Set(next.allowedOrigins)] };
}
export const DEFAULT_WIDGET: WidgetSettings = { enabled: false, allowedOrigins: [], greeting: "Hi! How can I help?", accent: "#db2777" };

const MAX_INSTRUCTIONS = 8000;
export const PASSAGES = 5;

async function checked(ctx: AppContext, orgId: string, input: Partial<AssistantInput>) {
  if (input.instructions && input.instructions.length > MAX_INSTRUCTIONS)
    throw invalid(`Instructions are at most ${MAX_INSTRUCTIONS} characters.`);
  if (input.model && !/^[a-z][a-z0-9-]*(\/.+)?$/.test(input.model)) throw invalid("A model is one of the app's names or <vendor>/<model>.");
  const ids = [...new Set(input.knowledgeBaseIds ?? [])];
  const knowledge = knowledgeOf(ctx);
  if (ids.length && !knowledge) throw invalid("This app has no knowledge bases (the knowledge module is off).");
  for (const id of ids) await knowledge!.assertBase(orgId, id); // the Organization's own, or 404
  return ids;
}

export async function createAssistant(
  ctx: AppContext,
  who: { orgId: string; userId: string | null },
  input: AssistantInput,
): Promise<Assistant> {
  const knowledgeBaseIds = await checked(ctx, who.orgId, input);
  const [row] = await ctx.db
    .insert(assistants)
    .values({
      id: newId(),
      organizationId: who.orgId,
      name: input.name,
      instructions: input.instructions ?? "",
      model: input.model || null,
      knowledgeBaseIds,
      widget: checkWidget(DEFAULT_WIDGET, input.widget ?? {}),
      createdBy: who.userId,
    })
    .returning();
  return row!;
}

export async function getAssistant(ctx: AppContext, orgId: string, id: string): Promise<Assistant> {
  const [a] = await ctx.db
    .select()
    .from(assistants)
    .where(and(eq(assistants.id, id), eq(assistants.organizationId, orgId)));
  if (!a) throw notFound("Assistant");
  return a;
}

export async function listAssistants(ctx: AppContext, orgId: string) {
  return ctx.db.select().from(assistants).where(eq(assistants.organizationId, orgId)).orderBy(desc(assistants.updatedAt));
}

export async function updateAssistant(ctx: AppContext, orgId: string, id: string, input: Partial<AssistantInput>) {
  const current = await getAssistant(ctx, orgId, id);
  // Checks what's changing; knowledge bases only when they're given.
  const ids = await checked(ctx, orgId, input);
  const knowledgeBaseIds = input.knowledgeBaseIds ? ids : undefined;
  const [row] = await ctx.db
    .update(assistants)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.model !== undefined ? { model: input.model || null } : {}),
      ...(knowledgeBaseIds ? { knowledgeBaseIds } : {}),
      ...(input.widget ? { widget: checkWidget(current.widget, input.widget) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(assistants.id, id))
    .returning();
  return row!;
}

export async function deleteAssistant(ctx: AppContext, orgId: string, id: string) {
  const a = await getAssistant(ctx, orgId, id);
  if (a.builtin) throw invalid("The built-in widget can't be deleted. Edit it, or choose another widget for the app.");
  await ctx.db.delete(assistants).where(eq(assistants.id, id));
}

/** What a turn with this assistant gives the model: its instructions and what its knowledge says about the message. */
export async function prepareTurn(ctx: AppContext, a: Assistant, message: string): Promise<{ system: string; sources: KnowledgeHit[] }> {
  const knowledge = knowledgeOf(ctx);
  // Bases deleted since the assistant was saved are skipped.
  const live: string[] = [];
  if (knowledge)
    for (const id of a.knowledgeBaseIds) {
      try {
        await knowledge.assertBase(a.organizationId, id);
        live.push(id);
      } catch {
        // gone
      }
    }
  const sources = live.length ? await knowledge!.search(a.organizationId, live, message, PASSAGES) : [];
  const parts = [a.instructions.trim() || "You are a helpful assistant."];
  if (live.length) {
    parts.push(
      sources.length
        ? [
            "Answer from the passages below, which come from this organization's knowledge base. Cite them as [1], [2]. If they don't answer the question, say you don't know rather than guessing.",
            ...sources.map((s, i) => `[${i + 1}] ${s.documentTitle}\n${s.text}`),
          ].join("\n\n")
        : "Nothing in this organization's knowledge base matches the question. Say you don't know rather than guessing.",
    );
  }
  return { system: parts.join("\n\n"), sources };
}
