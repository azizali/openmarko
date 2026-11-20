// Knowledge bases: an Organization's documents, cut into chunks, each with an embedding from the base's own model
// and a text-search vector, for hybrid search. pgvector 0.8.0 (Neon and development).
import { sql } from "drizzle-orm";
import { customType, index, integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authOrganization } from "@app/kernel";

export const knowledge = pgSchema("knowledge");

/**
 * An embedding, of whatever size the base's model gives. Untyped `vector` so one table holds every model; HNSW
 * indexes cover the common sizes by casting (migration SQL), and other sizes are searched exactly.
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector",
  toDriver: (v) => `[${v.join(",")}]`,
  fromDriver: (v) => JSON.parse(v) as number[],
});
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const bases = knowledge.table(
  "bases",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // Recorded once: a base never mixes models. Changing the model means a new base (or re-embedding into one).
    embeddingModel: text("embedding_model").notNull(),
    dimensions: integer("dimensions").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("bases_org").on(t.organizationId)],
);

export const documents = knowledge.table(
  "documents",
  {
    id: uuid("id").primaryKey(),
    baseId: uuid("base_id")
      .notNull()
      .references(() => bases.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull(), // 'text' | 'markdown' | 'pdf' | 'html' | 'url'
    sourceUrl: text("source_url"),
    // What was uploaded, kept until it's parsed (then cleared). Files move to object storage later.
    source: bytea("source"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    status: text("status").notNull().default("queued"), // 'queued' | 'processing' | 'ready' | 'failed'
    error: text("error"),
    chunkCount: integer("chunk_count").notNull().default(0),
    tokens: integer("tokens").notNull().default(0),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("documents_base").on(t.baseId, t.createdAt)],
);

export const chunks = knowledge.table(
  "chunks",
  {
    id: uuid("id").primaryKey(),
    baseId: uuid("base_id")
      .notNull()
      .references(() => bases.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    text: text("text").notNull(),
    tokens: integer("tokens").notNull(),
    dimensions: integer("dimensions").notNull(),
    embedding: vector("embedding").notNull(),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('simple', text)`),
  },
  (t) => [index("chunks_document").on(t.documentId, t.ordinal), index("chunks_base").on(t.baseId), index("chunks_tsv").using("gin", t.tsv)],
);
