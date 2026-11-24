// Conversations and streaming chat. A member of an Organization chats with one of the app's models; the answer
// streams as the AI SDK's UI message stream, so any AI SDK chat UI (useChat) reads it. Each turn is checked against
// the Organization's Plan before the model is called and recorded after: tokens are metered as `llm.tokens`, as
// "bring your own key" when the key is the Organization's own.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { convertToModelMessages, stepCountIs, streamText, type StepResult, type ToolSet, type UIMessage } from "ai";
import {
  AppError,
  authOrganization,
  billingOf,
  forbidden,
  newId,
  notFound,
  type AppContext,
  type Caller,
  type ToolPage,
} from "@app/kernel";
import { LLM_COST_PER_1K_TOKENS_MICROS } from "@app/integrations";
import { allows } from "@app/shared";
import { conversations, messages } from "./schema";
import { chooseModel } from "./models";
import { getAssistant, prepareTurn, type Assistant } from "./assistants";
import { usableAssistant } from "./chat-assistant";
import { toolsFor } from "./tools";

export const METER = "llm.tokens";

/** Chat answers streaming at once in this process. Past it, a turn is refused with 429 instead of queueing. */
export const CHAT_STREAMS = 20;
const streaming = new WeakMap<AppContext, { n: number }>();
function takeStream(ctx: AppContext): () => void {
  let s = streaming.get(ctx);
  if (!s) streaming.set(ctx, (s = { n: 0 }));
  if (s.n >= CHAT_STREAMS)
    throw new AppError(429, "too_many_streams", `This app is answering ${s.n} chats at once, its limit. Try again in a moment.`);
  s.n++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    s!.n = Math.max(0, s!.n - 1);
  };
}
const tokensOf = (chars: number) => Math.max(1, Math.ceil(chars / 4));
/** What a turn is expected to use before it runs: the history it sends, plus room for the answer. */
const ANSWER_ALLOWANCE = 1000;

export async function createConversation(
  ctx: AppContext,
  caller: Caller,
  input: { model?: string | null; title?: string | null; assistantId?: string | null },
) {
  // The Organization's own assistant, or the one the app offers it (chat-assistant.ts).
  if (input.assistantId) await usableAssistant(ctx, caller.orgId, input.assistantId);
  const id = newId();
  await ctx.db.insert(conversations).values({
    id,
    organizationId: caller.orgId,
    userId: caller.userId,
    model: input.model || null,
    assistantId: input.assistantId || null,
    ...(input.title ? { title: input.title } : {}),
  });
  return { id };
}

/** A member's own conversations; with `ai.history`, everyone's in the Organization. */
export async function listConversations(ctx: AppContext, caller: Caller, everyone = false) {
  if (everyone && !allows(caller.permission, "ai", "history"))
    throw forbidden(`Your role (${caller.role}) can't see others' conversations.`);
  return ctx.db
    .select()
    .from(conversations)
    .where(and(eq(conversations.organizationId, caller.orgId), everyone ? sql`true` : eq(conversations.userId, caller.userId)))
    .orderBy(desc(conversations.updatedAt))
    .limit(100);
}

/** A conversation the caller may read: their own, or anyone's with `ai.history`. Chatting in it is the owner's only. */
async function conversationFor(ctx: AppContext, caller: Caller, id: string, to: "read" | "chat") {
  const [c] = await ctx.db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.organizationId, caller.orgId)));
  const mine = c?.userId === caller.userId;
  if (!c || (!mine && (to === "chat" || !allows(caller.permission, "ai", "history")))) throw notFound("Conversation");
  return c;
}

export async function messagesOf(ctx: AppContext, caller: Caller, conversationId: string) {
  await conversationFor(ctx, caller, conversationId, "read");
  return ctx.db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id));
}

export async function deleteConversation(ctx: AppContext, caller: Caller, conversationId: string) {
  await conversationFor(ctx, caller, conversationId, "chat");
  await ctx.db.delete(conversations).where(eq(conversations.id, conversationId));
}

/**
 * A member's turn in one of their conversations (the widget's visitors take theirs through runTurn too). `page` is
 * where they were in the app when they asked; the tools their Role allows may read it (ADR 0036).
 */
export async function chat(
  ctx: AppContext,
  caller: Caller,
  conversationId: string,
  text: string,
  signal?: AbortSignal,
  page: ToolPage | null = null,
): Promise<Response> {
  const conv = await conversationFor(ctx, caller, conversationId, "chat");
  if (!conv.assistantId) return runTurn(ctx, { orgId: caller.orgId, conv, text, signal, caller, page });
  // An assistant offered by the app or a Partner is another Organization's: its knowledge and model are used, and that
  // Organization is the one metered. One no longer offered stops here, so an old chat can't keep using it.
  const assistant = await usableAssistant(ctx, caller.orgId, conv.assistantId).catch(() => {
    throw new AppError(409, "assistant_unavailable", "This chat's assistant isn't available any more. Start a new chat.");
  });
  // Its tools still act for the member, in the member's own Organization.
  return runTurn(ctx, { orgId: assistant.organizationId, conv, text, signal, assistant, caller, page });
}

/**
 * `orgId` is the Organization that answers and is metered: the conversation's own, or the owner of an assistant it was
 * offered. `assistant` is given when the caller has already settled which one (otherwise it is looked up in `orgId`).
 */
export type Turn = {
  orgId: string;
  conv: typeof conversations.$inferSelect;
  text: string;
  signal?: AbortSignal;
  assistant?: Assistant;
  /** The member taking the turn: their tools are offered. A website's visitor has none, so gets no tools. */
  caller?: Caller;
  page?: ToolPage | null;
};

/** The Organization's name, for the member's chat. */
async function organizationName(ctx: AppContext, orgId: string): Promise<string> {
  const [org] = await ctx.db.select({ name: authOrganization.name }).from(authOrganization).where(eq(authOrganization.id, orgId));
  return org?.name ?? "this organization";
}

/** Model calls one turn may make: tool calls and their answers. Past it the turn ends with what it has. */
export const TOOL_STEPS = 5;

/**
 * What the model is told in a member's chat (ADR 0036): the widget's own instructions, then what this app does for
 * them, from the enabled modules' briefs, then how to use its tools and where the member is. Never the app's name:
 * a Partner may whitelabel it. A visitor's chat on a website gets only the widget's instructions.
 */
export function memberSystem(
  base: string | undefined,
  m: { organization: string; briefs: string[]; hasTools: boolean; page: ToolPage | null },
): string {
  const lines = [base?.trim() || "You are a helpful assistant."];
  lines.push(
    [
      `You are the assistant inside the app the member is using, for the organization "${m.organization}".`,
      ...(m.briefs.length ? ["What the app does:", ...m.briefs] : []),
      "When the member asks about something this app does, answer from it: use a tool when one reaches it, and otherwise say which page of the app shows it. Never send them to another product or tool for something this app does.",
    ].join("\n\n"),
  );
  if (m.hasTools)
    lines.push(
      "You can use tools to look up this organization's data and to propose changes. Prefer a tool over guessing about the organization.",
      "A tool that proposes a change returns whether it was applied. If not, it waits for a member to apply it: say so, and never say a change was made when it wasn't.",
    );
  if (m.page)
    lines.push(
      `The member is on the page ${m.page.path}${Object.keys(m.page.params).length ? ` (${JSON.stringify(m.page.params)})` : ""}.`,
    );
  lines.push("Write in Markdown: short paragraphs, lists for several items, bold for what matters most.");
  return lines.join("\n\n");
}

/**
 * The answer as UI message parts: each step's text, and each tool call with what it returned, so the history the
 * model reads next turn (and the chat shows) keeps them. An answer without tools is one text part, as before.
 */
export function partsOf(steps: StepResult<ToolSet>[], answer: string): UIMessage["parts"] {
  const used = steps.some((s) => s.content.some((c) => c.type === "tool-result" || c.type === "tool-error"));
  if (!used) return [{ type: "text", text: answer }];
  const parts: UIMessage["parts"] = [];
  for (const step of steps) {
    parts.push({ type: "step-start" });
    for (const c of step.content) {
      if (c.type === "text" && c.text) parts.push({ type: "text", text: c.text });
      else if (c.type === "tool-result")
        parts.push({
          type: "dynamic-tool",
          toolName: c.toolName,
          toolCallId: c.toolCallId,
          state: "output-available",
          input: c.input,
          output: c.output,
        });
      else if (c.type === "tool-error")
        parts.push({
          type: "dynamic-tool",
          toolName: c.toolName,
          toolCallId: c.toolCallId,
          state: "output-error",
          input: c.input,
          errorText: c.error instanceof Error ? c.error.message : String(c.error),
        });
    }
  }
  return parts;
}

/**
 * One turn: saves the message, streams the model's answer, and when it's done saves it with its usage. Checked
 * against the Organization's Plan first; a turn the client abandons (it disconnects) stops the model.
 */
export async function runTurn(ctx: AppContext, t: Turn): Promise<Response> {
  const { conv, text, signal } = t;
  const conversationId = conv.id;
  const orgId = t.orgId;
  const billing = billingOf(ctx);
  // With an assistant: its model, its instructions, and what its knowledge says about this message.
  const assistant = t.assistant ?? (conv.assistantId ? await getAssistant(ctx, orgId, conv.assistantId).catch(() => null) : null);
  const turn = assistant ? await prepareTurn(ctx, assistant, text) : { system: undefined, sources: [] };
  const sources = turn.sources.map((s) => ({ documentId: s.documentId, documentTitle: s.documentTitle, chunkId: s.chunkId, text: s.text }));
  const chosen = await chooseModel(ctx, { organizationId: orgId }, assistant?.model ?? conv.model);
  const byok = chosen.keyOrganizationId === orgId;
  const tools = t.caller ? toolsFor(ctx, t.caller, { conversationId, page: t.page ?? null, signal }) : {};
  const hasTools = Object.keys(tools).length > 0;
  const system = t.caller
    ? memberSystem(turn.system, {
        organization: await organizationName(ctx, t.caller.orgId),
        briefs: (ctx.catalog?.briefs ?? []).map((b) => b.text),
        hasTools,
        page: t.page ?? null,
      })
    : turn.system;

  const history = await ctx.db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id));
  const sent = history.reduce((n, m) => n + JSON.stringify(m.parts).length, text.length);
  await billing.assertMeterAllowed(orgId, METER, tokensOf(sent) + ANSWER_ALLOWANCE, { byok });

  // A slot among the app's streams, given back however the stream ends.
  const release = takeStream(ctx);
  let result: ReturnType<typeof streamText>;
  try {
    const userMessage: UIMessage = { id: newId(), role: "user", parts: [{ type: "text", text }] };
    await ctx.db.insert(messages).values({ id: userMessage.id, conversationId, role: "user", parts: userMessage.parts });
    const ui: UIMessage[] = [
      ...history.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", parts: m.parts as UIMessage["parts"] })),
      userMessage,
    ];

    result = streamText({
      model: chosen.model,
      system,
      messages: await convertToModelMessages(ui),
      ...(hasTools ? { tools, stopWhen: stepCountIs(TOOL_STEPS) } : {}),
      temperature: chosen.settings.temperature,
      maxOutputTokens: chosen.settings.maxOutputTokens,
      abortSignal: signal,
      onAbort: () => release(),
      onError: () => release(),
      onFinish: async ({ text: answer, totalUsage, steps }) => {
        release();
        const used = totalUsage.totalTokens ?? tokensOf(sent + answer.length);
        const costMicros = Math.ceil((used * LLM_COST_PER_1K_TOKENS_MICROS) / 1000);
        await ctx.db.transaction(async (tx) => {
          await tx.insert(messages).values({
            id: newId(),
            conversationId,
            role: "assistant",
            parts: partsOf(steps, answer),
            modelId: chosen.modelId,
            inputTokens: totalUsage.inputTokens ?? null,
            outputTokens: totalUsage.outputTokens ?? null,
            costMicros,
            sources: sources.length ? sources : null,
          });
          await billing.recordUsage(tx, {
            organizationId: orgId,
            meter: METER,
            quantity: used,
            costMicros: byok ? 0 : costMicros,
            provider: chosen.providerId,
            mode: chosen.mode,
            meta: { conversationId, model: chosen.modelId, byok },
          });
          // The first message names the conversation, until someone renames it.
          await tx
            .update(conversations)
            .set({
              updatedAt: new Date(),
              ...(history.length === 0 && conv.title === "New conversation" ? { title: text.slice(0, 80) } : {}),
            })
            .where(eq(conversations.id, conversationId));
        });
      },
    });
  } catch (err) {
    release(); // nothing is streaming yet
    throw err;
  }
  // The sources go to the client first, as the answer's metadata, so it can show them while the text streams.
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) =>
      part.type === "start" && sources.length
        ? { sources: sources.map((s, i) => ({ n: i + 1, documentTitle: s.documentTitle, documentId: s.documentId })) }
        : undefined,
  });
}
