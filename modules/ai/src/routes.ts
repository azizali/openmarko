import { Elysia, t } from "elysia";
import { generateText } from "ai";
import { eq, sql } from "drizzle-orm";
import { authOrganization, ids, logActivity, notFound, type AppContext } from "@app/kernel";
import { requireAllowed } from "@app/shared";
import { listModels, vendorKeys, vendors } from "@app/integrations";
import { chat, createConversation, deleteConversation, listConversations, messagesOf } from "./chat";
import { createAssistant, deleteAssistant, getAssistant, listAssistants, prepareTurn, updateAssistant } from "./assistants";
import { assistants } from "./schema";
import { embedCode, widgetRoutes } from "./widget";
import { aiSettings, chooseModel } from "./models";
import { appChatAssistant, chatAssistantStatus, ensureBuiltin, setAppChatAssistant, setOrgChatAssistant } from "./chat-assistant";

export function aiRoutes(ctx: AppContext) {
  // The models a member may pick: the app's own names and its default (never keys or settings).
  const models = new Elysia({ name: "ai.models" }).group("/api/v1/organizations/:orgId/ai", (g) =>
    g
      .use(ctx.orgGuard!)
      .get(
        "/models",
        async ({ caller }) => {
          requireAllowed(caller, "ai", "chat");
          const cfg = await aiSettings(ctx);
          return { default: cfg.defaultModel || null, models: Object.entries(cfg.models).map(([name, m]) => ({ name, model: m.model })) };
        },
        { detail: { summary: "The models you can chat with: the app's model names and its default" } },
      )
      .get(
        "/chat-assistant",
        ({ caller }) => {
          requireAllowed(caller, "ai", "chat");
          return chatAssistantStatus(ctx, caller.orgId);
        },
        { detail: { summary: "The widget this Organization's members chat with in the app, and who chose it" } },
      )
      .put(
        "/chat-assistant",
        async ({ caller, body }) => {
          requireAllowed(caller, "ai", "configure");
          await setOrgChatAssistant(ctx, caller.orgId, body.assistantId, caller.userId);
          await ctx.db.transaction((tx) =>
            logActivity(tx, {
              organizationId: caller.orgId,
              actorType: "member",
              actorId: caller.userId,
              action: "ai.chat_assistant",
              resourceType: "assistant",
              resourceId: body.assistantId ?? "builtin",
              summary: body.assistantId ? "Chose the widget the app's chat uses" : "Went back to the app's choice of chat widget",
            }),
          );
          return chatAssistantStatus(ctx, caller.orgId);
        },
        {
          body: t.Object({ assistantId: t.Union([t.String({ format: "uuid" }), t.Null()]) }),
          detail: { summary: "Choose the widget the app's chat uses for this Organization (and its Clients); null takes the choice back" },
        },
      ),
  );
  const member = new Elysia({ name: "ai.chat" }).group("/api/v1/organizations/:orgId/ai/conversations", (g) =>
    g
      .use(ctx.orgGuard!)
      .get(
        "/",
        ({ caller, query }) => {
          requireAllowed(caller, "ai", "chat");
          return listConversations(ctx, caller, query.everyone === "true");
        },
        {
          query: t.Object({ everyone: t.Optional(t.String()) }),
          detail: { summary: "Your conversations (everyone's with ai.history and ?everyone=true)" },
        },
      )
      .post(
        "/",
        ({ caller, body }) => {
          requireAllowed(caller, "ai", "chat");
          return createConversation(ctx, caller, body);
        },
        {
          body: t.Object({
            model: t.Optional(t.String()),
            title: t.Optional(t.String({ maxLength: 120 })),
            assistantId: t.Optional(t.String({ format: "uuid" })),
          }),
          detail: {
            summary: "Start a conversation: with an assistant, or a model (a custom name or vendor/model; none: the app's default)",
          },
        },
      )
      .get(
        "/:conversationId/messages",
        ({ caller, params }) => {
          requireAllowed(caller, "ai", "chat");
          return messagesOf(ctx, caller, params.conversationId);
        },
        { params: ids("conversationId"), detail: { summary: "A conversation's messages, as AI SDK message parts" } },
      )
      .post(
        "/:conversationId/chat",
        ({ caller, params, body, request }) => {
          requireAllowed(caller, "ai", "chat");
          return chat(ctx, caller, params.conversationId, body.text, request.signal);
        },
        {
          params: ids("conversationId"),
          body: t.Object({ text: t.String({ minLength: 1, maxLength: 20000 }) }),
          detail: {
            summary: "Send a message and stream the answer (AI SDK UI message stream)",
            description:
              "Checked against the Organization's Plan (meter llm.tokens) first; the answer and its usage are saved when it finishes.",
          },
        },
      )
      .delete(
        "/:conversationId",
        async ({ caller, params }) => {
          requireAllowed(caller, "ai", "chat");
          await deleteConversation(ctx, caller, params.conversationId);
          return { ok: true };
        },
        { params: ids("conversationId"), detail: { summary: "Delete one of your conversations" } },
      ),
  );
  const assistantBody = {
    name: t.String({ minLength: 1, maxLength: 120 }),
    instructions: t.Optional(t.String({ maxLength: 8000 })),
    model: t.Optional(t.Union([t.String(), t.Null()])),
    knowledgeBaseIds: t.Optional(t.Array(t.String({ format: "uuid" }), { maxItems: 10 })),
    widget: t.Optional(
      t.Object({
        enabled: t.Optional(t.Boolean()),
        allowedOrigins: t.Optional(t.Array(t.String(), { maxItems: 20 })),
        greeting: t.Optional(t.String()),
        accent: t.Optional(t.String()),
      }),
    ),
  };
  // An Organization's assistants: everyone who may chat sees them; ai.configure makes and changes them.
  const assistantRoutes = new Elysia({ name: "ai.assistants" }).group("/api/v1/organizations/:orgId/ai/assistants", (g) =>
    g
      .use(ctx.orgGuard!)
      .get(
        "/",
        async ({ caller }) => {
          requireAllowed(caller, "ai", "chat");
          await ensureBuiltin(ctx, caller.orgId); // every Organization has its starter widget
          return (await listAssistants(ctx, caller.orgId)).map((a) => ({ ...a, embedCode: embedCode(ctx, a.id) }));
        },
        { detail: { summary: "The Organization's assistants" } },
      )
      .post(
        "/",
        ({ caller, body }) => {
          requireAllowed(caller, "ai", "configure");
          return createAssistant(ctx, caller, body);
        },
        {
          body: t.Object(assistantBody),
          detail: { summary: "Create an assistant: a model, instructions and the knowledge bases it answers from" },
        },
      )
      .patch(
        "/:assistantId",
        ({ caller, params, body }) => {
          requireAllowed(caller, "ai", "configure");
          return updateAssistant(ctx, caller.orgId, params.assistantId, body);
        },
        { params: ids("assistantId"), body: t.Partial(t.Object(assistantBody)), detail: { summary: "Change an assistant" } },
      )
      .delete(
        "/:assistantId",
        async ({ caller, params }) => {
          requireAllowed(caller, "ai", "configure");
          await deleteAssistant(ctx, caller.orgId, params.assistantId);
          return { ok: true };
        },
        { params: ids("assistantId"), detail: { summary: "Delete an assistant (its conversations stay, as plain chats)" } },
      ),
  );
  // The platform admin area: every assistant, made for an Organization, and a test chat.
  const assistantAdmin = new Elysia({ name: "ai.assistants.admin" }).group("/api/v1/admin/ai/assistants", (g) =>
    g
      .use(ctx.adminGuard!)
      .get(
        "/",
        () =>
          ctx.db
            .select({
              id: assistants.id,
              name: assistants.name,
              organizationId: assistants.organizationId,
              organization: sql<string>`(select name from auth.organization o where o.id = "assistants"."organization_id")`,
              model: assistants.model,
              instructions: assistants.instructions,
              knowledgeBaseIds: assistants.knowledgeBaseIds,
              widget: assistants.widget,
              updatedAt: assistants.updatedAt,
            })
            .from(assistants)
            .orderBy(assistants.updatedAt),
        { detail: { summary: "Every assistant, with its Organization" } },
      )
      .post(
        "/",
        async ({ body }) => {
          const [org] = await ctx.db
            .select({ id: authOrganization.id })
            .from(authOrganization)
            .where(eq(authOrganization.id, body.organizationId));
          if (!org) throw notFound("Organization");
          return createAssistant(ctx, { orgId: body.organizationId, userId: null }, body);
        },
        {
          body: t.Object({ organizationId: t.String(), ...assistantBody }),
          detail: { summary: "Create an assistant for an Organization" },
        },
      )
      .patch(
        "/:assistantId",
        async ({ params, body }) => {
          const [a] = await ctx.db.select().from(assistants).where(eq(assistants.id, params.assistantId));
          if (!a) throw notFound("Assistant");
          return updateAssistant(ctx, a.organizationId, a.id, body);
        },
        { body: t.Partial(t.Object(assistantBody)), detail: { summary: "Change an assistant (its widget too)" } },
      )
      .post(
        "/:assistantId/test",
        async ({ params, body }) => {
          const [a] = await ctx.db.select().from(assistants).where(eq(assistants.id, params.assistantId));
          if (!a) throw notFound("Assistant");
          const assistant = await getAssistant(ctx, a.organizationId, a.id);
          const turn = await prepareTurn(ctx, assistant, body.message);
          const chosen = await chooseModel(ctx, { organizationId: a.organizationId }, assistant.model);
          const r = await generateText({
            model: chosen.model,
            system: turn.system,
            prompt: body.message,
            maxOutputTokens: chosen.settings.maxOutputTokens ?? 800,
            temperature: chosen.settings.temperature,
          });
          return {
            text: r.text,
            model: chosen.modelId,
            mode: chosen.mode,
            usage: r.usage,
            sources: turn.sources.map((s, i) => ({ n: i + 1, documentTitle: s.documentTitle, text: s.text, score: s.score })),
          };
        },
        {
          body: t.Object({ message: t.String({ minLength: 1, maxLength: 4000 }) }),
          detail: { summary: "Try an assistant: one message, its answer and the knowledge it was given (not saved, not metered)" },
        },
      ),
  );
  const modelsAdmin = new Elysia({ name: "ai.models.admin" }).group("/api/v1/admin/ai", (g) =>
    g
      .use(ctx.adminGuard!)
      .get("/", async () => ({ settings: await aiSettings(ctx), vendors: await vendorKeys(ctx) }), {
        detail: { summary: "The app's models: its default and custom names, and which vendors it has a key for" },
      })
      .get("/chat-assistant", () => appChatAssistant(ctx), {
        detail: { summary: "The widget the app's chat uses for everyone without a choice of their own, and the Organization that owns it" },
      })
      .put(
        "/chat-assistant",
        async ({ admin, body }) => {
          await setAppChatAssistant(ctx, body.assistantId, admin.userId);
          await ctx.db.transaction((tx) =>
            logActivity(tx, {
              actorType: "admin",
              actorId: admin.userId,
              action: "ai.chat_assistant",
              resourceType: "assistant",
              resourceId: body.assistantId ?? "builtin",
              summary: body.assistantId ? "Chose the widget the whole app's chat uses" : "Cleared the app's choice of chat widget",
            }),
          );
          return appChatAssistant(ctx);
        },
        {
          body: t.Object({ assistantId: t.Union([t.String({ format: "uuid" }), t.Null()]) }),
          detail: { summary: "Choose the widget the app's chat uses for everyone (any Organization's); null takes the choice back" },
        },
      )
      .get("/vendors/:vendor/models", ({ params, query }) => listModels(ctx, {}, params.vendor, { fresh: query.fresh === "true" }), {
        params: t.Object({ vendor: t.Union(vendors.map((v) => t.Literal(v))) }),
        query: t.Object({ fresh: t.Optional(t.String()) }),
        detail: { summary: "The models a vendor offers through the app's key, as the vendor's own API lists them (cached ten minutes)" },
      })
      .post(
        "/test",
        async ({ admin, body }) => {
          const chosen = await chooseModel(ctx, {}, body.model);
          const started = Date.now();
          const r = await generateText({
            model: chosen.model,
            prompt: body.prompt,
            maxOutputTokens: chosen.settings.maxOutputTokens ?? 512,
            temperature: chosen.settings.temperature,
          });
          await ctx.db.transaction((tx) =>
            logActivity(tx, {
              actorType: "admin",
              actorId: admin.userId,
              action: "ai.test",
              resourceType: "model",
              resourceId: chosen.modelId,
              summary: `Tried ${chosen.modelId}`,
            }),
          );
          return { text: r.text, name: chosen.name, model: chosen.modelId, mode: chosen.mode, usage: r.usage, ms: Date.now() - started };
        },
        {
          body: t.Object({ model: t.Optional(t.String()), prompt: t.String({ minLength: 1, maxLength: 4000 }) }),
          detail: { summary: "Try a model: one prompt, its answer, the model it resolved to and the tokens it used" },
        },
      ),
  );
  return new Elysia({ name: "ai" })
    .use(models)
    .use(member)
    .use(assistantRoutes)
    .use(assistantAdmin)
    .use(widgetRoutes(ctx))
    .use(modelsAdmin);
}
