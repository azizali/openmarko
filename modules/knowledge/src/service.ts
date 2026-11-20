// Knowledge bases. An Organization's documents, embedded with the base's own model and searched by meaning and by
// words together (hybrid). Ingesting runs in the worker: parse, chunk, embed, store.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { embedMany, embed } from "ai";
import { AppError, billingOf, invalid, newId, notFound, type AppContext } from "@app/kernel";
import { embeddingModel, LLM_COST_PER_1K_TOKENS_MICROS, parseModelRef } from "@app/integrations";
import { bases, chunks, documents } from "./schema";
import { MAX_DOCUMENT_BYTES, textOf, type Kind } from "./extract";
import { chunkText, MAX_CHUNKS, tokensOf } from "./chunk";

export const INGEST_JOB = "knowledge.ingest";
const METER = "llm.tokens";

/** Known embedding models and their sizes. Others can be named with their size. */
export const knownEmbeddingModels: Record<string, number> = {
  "openai/text-embedding-3-small": 1536,
  "openai/text-embedding-3-large": 3072,
  "google/text-embedding-004": 768,
  "google/gemini-embedding-001": 768,
};
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

type Who = { orgId: string; userId: string | null };

// ---------- Bases ----------

export async function createBase(
  ctx: AppContext,
  who: Who,
  input: { name: string; description?: string; embeddingModel?: string; dimensions?: number },
) {
  const model = input.embeddingModel || DEFAULT_EMBEDDING_MODEL;
  const ref = parseModelRef(model);
  if (ref.vendor !== "openai" && ref.vendor !== "google") throw invalid("Embeddings come from openai or google models.");
  const dimensions = input.dimensions ?? knownEmbeddingModels[model];
  if (!dimensions) throw invalid(`Say how many dimensions ${model} gives.`);
  if (dimensions < 8 || dimensions > 4000) throw invalid("Dimensions are between 8 and 4,000.");
  const id = newId();
  await ctx.db.insert(bases).values({
    id,
    organizationId: who.orgId,
    name: input.name,
    description: input.description ?? "",
    embeddingModel: model,
    dimensions,
    createdBy: who.userId,
  });
  return getBase(ctx, who.orgId, id);
}

export async function getBase(ctx: AppContext, orgId: string, id: string) {
  const [b] = await ctx.db
    .select()
    .from(bases)
    .where(and(eq(bases.id, id), eq(bases.organizationId, orgId)));
  if (!b) throw notFound("Knowledge base");
  return b;
}

export async function listBases(ctx: AppContext, orgId: string) {
  return ctx.db
    .select({
      id: bases.id,
      name: bases.name,
      description: bases.description,
      embeddingModel: bases.embeddingModel,
      dimensions: bases.dimensions,
      createdAt: bases.createdAt,
      documents: sql<number>`(select count(*)::int from knowledge.documents d where d.base_id = "bases"."id")`,
      chunks: sql<number>`(select count(*)::int from knowledge.chunks c where c.base_id = "bases"."id")`,
    })
    .from(bases)
    .where(eq(bases.organizationId, orgId))
    .orderBy(asc(bases.name));
}

export async function deleteBase(ctx: AppContext, orgId: string, id: string) {
  await getBase(ctx, orgId, id);
  await ctx.db.delete(bases).where(eq(bases.id, id));
}

// ---------- Documents ----------

export type NewDocument = { title: string; kind: Kind; content?: string; bytes?: Uint8Array; url?: string };

export async function addDocument(ctx: AppContext, who: Who, baseId: string, input: NewDocument) {
  await getBase(ctx, who.orgId, baseId);
  if (input.kind === "url") {
    if (!input.url || !/^https?:\/\//.test(input.url)) throw invalid("A web page is an http or https URL.");
  } else if (!input.bytes && input.content === undefined) throw invalid("The document has no content.");
  const bytes = input.bytes ?? (input.content !== undefined ? new TextEncoder().encode(input.content) : null);
  if (bytes && bytes.byteLength > MAX_DOCUMENT_BYTES) throw new AppError(413, "too_large", "Documents are 10 MB at most.");
  const id = newId();
  await ctx.db.insert(documents).values({
    id,
    baseId,
    title: input.title,
    kind: input.kind,
    sourceUrl: input.url ?? null,
    source: bytes ? Buffer.from(bytes) : null,
    sizeBytes: bytes?.byteLength ?? 0,
    createdBy: who.userId,
  });
  await queueIngest(ctx, who.orgId, id);
  return getDocument(ctx, who.orgId, id);
}

async function queueIngest(ctx: AppContext, organizationId: string, documentId: string) {
  if (!ctx.enqueue) throw new Error("No queue in this process to ingest documents with.");
  await ctx.enqueue(INGEST_JOB, { documentId }, { organizationId });
}

const docColumns = {
  id: documents.id,
  baseId: documents.baseId,
  title: documents.title,
  kind: documents.kind,
  sourceUrl: documents.sourceUrl,
  sizeBytes: documents.sizeBytes,
  status: documents.status,
  error: documents.error,
  chunkCount: documents.chunkCount,
  tokens: documents.tokens,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

export async function getDocument(ctx: AppContext, orgId: string, id: string) {
  const [d] = await ctx.db
    .select(docColumns)
    .from(documents)
    .innerJoin(bases, eq(bases.id, documents.baseId))
    .where(and(eq(documents.id, id), eq(bases.organizationId, orgId)));
  if (!d) throw notFound("Document");
  return d;
}

export async function listDocuments(ctx: AppContext, orgId: string, baseId: string) {
  await getBase(ctx, orgId, baseId);
  return ctx.db.select(docColumns).from(documents).where(eq(documents.baseId, baseId)).orderBy(desc(documents.createdAt));
}

export async function deleteDocument(ctx: AppContext, orgId: string, id: string) {
  await getDocument(ctx, orgId, id);
  await ctx.db.delete(documents).where(eq(documents.id, id));
}

/** Embeds a document again (its source is kept until it's ready; a web page is fetched again). */
export async function reindexDocument(ctx: AppContext, orgId: string, id: string) {
  const d = await getDocument(ctx, orgId, id);
  if (d.kind !== "url") {
    const [row] = await ctx.db.select({ source: documents.source }).from(documents).where(eq(documents.id, id));
    if (!row?.source) throw invalid("This document's file isn't kept once it's ready; add it again to re-embed it.");
  }
  await ctx.db.update(documents).set({ status: "queued", error: null, updatedAt: new Date() }).where(eq(documents.id, id));
  await queueIngest(ctx, orgId, id);
}

// ---------- Ingesting (the worker) ----------

/** Asks the vendor for vectors of the base's size (both OpenAI's v3 models and Google's can shorten them). */
const providerOptions = (vendor: string, dimensions: number): Record<string, Record<string, number>> =>
  vendor === "openai" ? { openai: { dimensions } } : { google: { outputDimensionality: dimensions } };

/** Parses, chunks, embeds and stores one document. A failure marks it failed with the reason; nothing is half-stored. */
export async function ingest(ctx: AppContext, documentId: string): Promise<void> {
  const [row] = await ctx.db.select().from(documents).where(eq(documents.id, documentId));
  if (!row) return; // deleted since
  const [base] = await ctx.db.select().from(bases).where(eq(bases.id, row.baseId));
  if (!base) return;
  await ctx.db.update(documents).set({ status: "processing", updatedAt: new Date() }).where(eq(documents.id, documentId));
  try {
    const text = await textOf(row.kind as Kind, row.source ? new Uint8Array(row.source) : new Uint8Array(), row.sourceUrl);
    if (!text) throw invalid("No text found in this document (a scanned PDF has none).");
    const pieces = chunkText(text);
    if (pieces.length > MAX_CHUNKS) throw invalid(`This document is too long (over ${MAX_CHUNKS} chunks).`);
    const tokens = pieces.reduce((n, p) => n + tokensOf(p), 0);

    const resolved = await embeddingModel(ctx, { organizationId: base.organizationId }, base.embeddingModel, base.dimensions);
    const byok = resolved.organizationId === base.organizationId;
    const billing = billingOf(ctx);
    await billing.assertMeterAllowed(base.organizationId, METER, tokens, { byok });
    const { embeddings, usage } = await embedMany({
      model: resolved.model,
      values: pieces,
      providerOptions: providerOptions(resolved.ref.vendor, base.dimensions),
    });
    if (embeddings.some((e) => e.length !== base.dimensions)) {
      throw invalid(`${base.embeddingModel} gave vectors of ${embeddings[0]?.length} dimensions; this base expects ${base.dimensions}.`);
    }
    const used = Math.ceil(usage?.tokens ?? tokens);
    await ctx.db.transaction(async (tx) => {
      await tx.delete(chunks).where(eq(chunks.documentId, documentId));
      for (let i = 0; i < pieces.length; i += 200) {
        await tx.insert(chunks).values(
          pieces.slice(i, i + 200).map((p, j) => ({
            id: newId(),
            baseId: base.id,
            documentId,
            ordinal: i + j,
            text: p,
            tokens: tokensOf(p),
            dimensions: base.dimensions,
            embedding: embeddings[i + j]!,
          })),
        );
      }
      // Ready: the parsed text is in the chunks. An uploaded file is let go; a web page can be fetched again.
      await tx
        .update(documents)
        .set({ status: "ready", error: null, chunkCount: pieces.length, tokens, source: null, updatedAt: new Date() })
        .where(eq(documents.id, documentId));
      await billing.recordUsage(tx, {
        organizationId: base.organizationId,
        meter: METER,
        quantity: used,
        costMicros: byok ? 0 : Math.ceil((used * LLM_COST_PER_1K_TOKENS_MICROS) / 1000),
        provider: resolved.providerId,
        mode: resolved.mode,
        meta: { kind: "embed", baseId: base.id, documentId, byok },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ctx.db
      .update(documents)
      .set({ status: "failed", error: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    // A problem with the document itself won't change on a retry; anything else (a provider down) is retried.
    if (!(err instanceof AppError && err.status < 500)) throw err;
  }
}

// ---------- Searching ----------

export type Hit = { chunkId: string; documentId: string; documentTitle: string; baseId: string; text: string; score: number };

const RRF_K = 60;
const CANDIDATES = 40;

/**
 * Hybrid search over some of an Organization's bases: nearest neighbours by embedding and matches by words, fused
 * by rank (reciprocal rank fusion), so a chunk that both means and says the query comes first. Bases built with
 * different models are each searched with their own model.
 */
export async function search(ctx: AppContext, orgId: string, baseIds: string[], query: string, k = 5): Promise<Hit[]> {
  if (!baseIds.length) return [];
  const rows = await ctx.db
    .select()
    .from(bases)
    .where(and(eq(bases.organizationId, orgId), inArray(bases.id, baseIds)));
  if (rows.length !== new Set(baseIds).size) throw notFound("Knowledge base");
  const groups = new Map<string, typeof rows>();
  for (const b of rows)
    groups.set(`${b.embeddingModel}|${b.dimensions}`, [...(groups.get(`${b.embeddingModel}|${b.dimensions}`) ?? []), b]);

  const scored = new Map<string, Hit>();
  for (const group of groups.values()) {
    const { embeddingModel: model, dimensions } = group[0]!;
    const resolved = await embeddingModel(ctx, { organizationId: orgId }, model, dimensions);
    const { embedding } = await embed({
      model: resolved.model,
      value: query,
      providerOptions: providerOptions(resolved.ref.vendor, dimensions),
    });
    const ids = group.map((b) => b.id);
    // The size is a checked integer (8..4000), written into the cast so the matching HNSW index applies.
    const D = Math.trunc(dimensions);
    const vec = `[${embedding.join(",")}]`;
    const { rows: found } = await ctx.pool.query<Hit & { rank_v: number | null; rank_t: number | null }>(
      `with vec as (
         select c.id, row_number() over (order by c.embedding::vector(${D}) <=> $1::vector(${D})) as r
           from knowledge.chunks c
          where c.base_id = any($2::uuid[]) and c.dimensions = ${D}
          order by c.embedding::vector(${D}) <=> $1::vector(${D})
          limit ${CANDIDATES}),
       txt as (
         select c.id, row_number() over (order by ts_rank(c.tsv, q) desc) as r
           from knowledge.chunks c, plainto_tsquery('simple', $3) q
          where c.base_id = any($2::uuid[]) and c.tsv @@ q
          limit ${CANDIDATES})
       select c.id as "chunkId", c.document_id as "documentId", d.title as "documentTitle", c.base_id as "baseId", c.text,
              vec.r as rank_v, txt.r as rank_t
         from knowledge.chunks c
         join knowledge.documents d on d.id = c.document_id
         left join vec on vec.id = c.id
         left join txt on txt.id = c.id
        where vec.id is not null or txt.id is not null`,
      [vec, ids, query],
    );
    for (const f of found) {
      const score = (f.rank_v ? 1 / (RRF_K + Number(f.rank_v)) : 0) + (f.rank_t ? 1 / (RRF_K + Number(f.rank_t)) : 0);
      scored.set(f.chunkId, {
        chunkId: f.chunkId,
        documentId: f.documentId,
        documentTitle: f.documentTitle,
        baseId: f.baseId,
        text: f.text,
        score,
      });
    }
  }
  return [...scored.values()].toSorted((a, b) => b.score - a.score).slice(0, k);
}
