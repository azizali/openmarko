// Assistants, conversations and their messages. A conversation belongs to one member of one Organization (or a
// widget visitor); messages keep the AI SDK's parts, so a chat UI reloads them as they were streamed.
import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { authOrganization } from "@app/kernel";

export const ai = pgSchema("ai");

/**
 * An assistant: a model, instructions and the knowledge bases it answers from. It belongs to an Organization,
 * whose members chat with it. Tools come from the modules (ADR 0036), not from the assistant.
 */
export const assistants = ai.table(
  "assistants",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    instructions: text("instructions").notNull().default(""),
    // A custom model name or a model id; null: the app's default.
    model: text("model"),
    // Knowledge bases it answers from (the Organization's own; checked when saved). No foreign key: a base removed later
    // simply drops out.
    knowledgeBaseIds: uuid("knowledge_base_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    // The chat widget: off until turned on; it answers only on these origins.
    widget: jsonb("widget")
      .$type<{ enabled: boolean; allowedOrigins: string[]; greeting: string; accent: string }>()
      .notNull()
      .default(sql`'{"enabled":false,"allowedOrigins":[],"greeting":"Hi! How can I help?","accent":"#db2777"}'::jsonb`),
    // The starter every Organization has (chat-assistant.ts): what the app's chat uses when nothing else is chosen. It
    // is edited like any other, and never deleted. At most one per Organization.
    builtin: boolean("builtin").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("assistants_org").on(t.organizationId),
    uniqueIndex("assistants_one_builtin")
      .on(t.organizationId)
      .where(sql`builtin`),
  ],
);

export const conversations = ai.table(
  "conversations",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    // With an assistant, its model, instructions and knowledge apply; without, it's a plain chat with a model.
    assistantId: uuid("assistant_id").references(() => assistants.id, { onDelete: "set null" }),
    title: text("title").notNull().default("New conversation"),
    // What was asked for: a custom name or a model id. Null: the app's default at each turn.
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("conversations_member").on(t.organizationId, t.userId, t.updatedAt)],
);

export const messages = ai.table(
  "messages",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant'
    parts: jsonb("parts").$type<unknown[]>().notNull(),
    // For an assistant message: the model that answered, and what it used.
    modelId: text("model_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costMicros: bigint("cost_micros", { mode: "number" }),
    // For an assistant's answer: the knowledge it was given (document, chunk, passage), for citations.
    sources: jsonb("sources").$type<{ documentId: string; documentTitle: string; chunkId: string; text: string }[] | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("messages_conversation").on(t.conversationId, t.createdAt)],
);
