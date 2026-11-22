// The assistant the app's chat talks to (ADR 0030). A widget is an Assistant (ADR 0025); this chooses which one the
// floating chat in the app uses, for whom. The nearest choice wins:
//
//   the Organization's own  →  its Partner's  →  the app's  →  the Organization's built-in
//
// A Partner's choice is its Organization's, which reaches its Clients; a Client that makes its own choice overrides it.
// The app's is made by an app admin and reaches everyone, whichever Organization built the widget. The built-in is the
// starter every Organization has, with no instructions and the app's default model, so the chat always has an
// assistant and works before anyone chooses.
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authOrganization, newId, notFound, type AppContext } from "@app/kernel";
import { readAppSetting, readSetting, writeAppSetting, writeSetting } from "@app/settings";
import { DEFAULT_WIDGET, getAssistant, type Assistant } from "./assistants";
import { assistants } from "./schema";

export const NAMESPACE = "ai.assistant";

/** The setting's value, at the app level and at an Organization. Null: nothing chosen here, so the next level answers. */
export const chatAssistantSchema = z.object({
  assistantId: z.string().uuid().nullable().default(null).describe("The widget the app's chat uses. Empty: the built-in one."),
});
type Chosen = z.infer<typeof chatAssistantSchema>;

export type ChatLevel = "organization" | "partner" | "app" | "builtin";
export type InUse = {
  assistantId: string;
  name: string;
  greeting: string;
  /** The widget's colour (#rrggbb). Null for an untouched built-in widget, so the chat keeps the app's own colour. */
  accent: string | null;
  level: ChatLevel;
  ownerOrganizationId: string;
};
export type ChatAssistantStatus = {
  /** What this Organization's members chat with now, and which choice that came from. */
  inUse: InUse;
  /** The widget this Organization chose for itself (and its Clients, when it is a Partner). Null: it hasn't. */
  own: string | null;
  /** What the Partner and the app offer, so a page can say who decided. Null: nothing chosen there. */
  partner: { assistantId: string; name: string } | null;
  app: { assistantId: string; name: string } | null;
};

/** The Organization's starter widget, made the first time it's needed. */
export async function ensureBuiltin(ctx: AppContext, orgId: string): Promise<Assistant> {
  const find = async () => {
    const [a] = await ctx.db
      .select()
      .from(assistants)
      .where(and(eq(assistants.organizationId, orgId), eq(assistants.builtin, true)));
    return a ?? null;
  };
  const have = await find();
  if (have) return have;
  // Two first requests at once: the unique index lets one insert win and the other read it.
  await ctx.db
    .insert(assistants)
    .values({ id: newId(), organizationId: orgId, name: "Assistant", builtin: true, widget: DEFAULT_WIDGET })
    .onConflictDoNothing();
  return (await find())!;
}

/** An assistant that exists and belongs to `owner`: a stored choice for a deleted or foreign one reads as unmade. */
async function chosenBy(ctx: AppContext, id: string | null | undefined, owner?: string): Promise<Assistant | null> {
  if (!id) return null;
  const [a] = await ctx.db.select().from(assistants).where(eq(assistants.id, id));
  return a && (!owner || a.organizationId === owner) ? a : null;
}

const asInUse = (a: Assistant, level: ChatLevel): InUse => ({
  assistantId: a.id,
  name: a.name,
  greeting: a.widget.greeting,
  accent: level === "builtin" && a.widget.accent === DEFAULT_WIDGET.accent ? null : a.widget.accent,
  level,
  ownerOrganizationId: a.organizationId,
});

export async function chatAssistantStatus(ctx: AppContext, orgId: string): Promise<ChatAssistantStatus> {
  const [org] = await ctx.db.select({ partnerId: authOrganization.partnerId }).from(authOrganization).where(eq(authOrganization.id, orgId));
  if (!org) throw notFound("Organization");
  const own = await chosenBy(ctx, (await readSetting<Chosen>(ctx, "organization", orgId, NAMESPACE))?.value.assistantId, orgId);
  const partner = org.partnerId
    ? await chosenBy(ctx, (await readSetting<Chosen>(ctx, "organization", org.partnerId, NAMESPACE))?.value.assistantId, org.partnerId)
    : null;
  const app = await chosenBy(ctx, (await readAppSetting<Chosen>(ctx, NAMESPACE))?.value.assistantId);
  const picked = own ? asInUse(own, "organization") : partner ? asInUse(partner, "partner") : app ? asInUse(app, "app") : null;
  return {
    inUse: picked ?? asInUse(await ensureBuiltin(ctx, orgId), "builtin"),
    own: own?.id ?? null,
    partner: partner ? { assistantId: partner.id, name: partner.name } : null,
    app: app ? { assistantId: app.id, name: app.name } : null,
  };
}

/** What a member of `orgId` chats with now. */
export const resolveChatAssistant = async (ctx: AppContext, orgId: string) => (await chatAssistantStatus(ctx, orgId)).inUse;

/**
 * An assistant a member of `orgId` may chat with: one the Organization owns, or the one it is offered (its Partner's
 * or the app's). Anyone else's is not found, so a conversation can't be pointed at an assistant by guessing its id.
 */
export async function usableAssistant(ctx: AppContext, orgId: string, assistantId: string): Promise<Assistant> {
  const [a] = await ctx.db.select().from(assistants).where(eq(assistants.id, assistantId));
  if (a && a.organizationId === orgId) return a;
  if (a && (await resolveChatAssistant(ctx, orgId)).assistantId === a.id) return a;
  throw notFound("Assistant");
}

/** The Organization's choice, for itself and any Clients. It can only choose its own widget; null takes the choice back. */
export async function setOrgChatAssistant(ctx: AppContext, orgId: string, assistantId: string | null, by: string | null) {
  if (assistantId) await getAssistant(ctx, orgId, assistantId);
  await writeSetting<Chosen>(ctx, "organization", orgId, NAMESPACE, { assistantId }, { by });
}

/** The app's choice, made by an app admin: any Organization's widget. */
export async function setAppChatAssistant(ctx: AppContext, assistantId: string | null, by: string | null) {
  if (assistantId && !(await chosenBy(ctx, assistantId))) throw notFound("Assistant");
  await writeAppSetting<Chosen>(ctx, NAMESPACE, { assistantId }, { by });
}

/** The app's choice, with the Organization that owns the widget, for the platform admin area. */
export async function appChatAssistant(ctx: AppContext) {
  const a = await chosenBy(ctx, (await readAppSetting<Chosen>(ctx, NAMESPACE))?.value.assistantId);
  if (!a) return { assistantId: null, name: null, organization: null };
  const [org] = await ctx.db
    .select({ name: authOrganization.name })
    .from(authOrganization)
    .where(eq(authOrganization.id, a.organizationId));
  return { assistantId: a.id, name: a.name, organization: org?.name ?? null };
}
