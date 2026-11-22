import { Elysia, t } from "elysia";
import { eq, sql } from "drizzle-orm";
import { authOrganization, ids, invalid, notFound, type AppContext } from "@app/kernel";
import { bases } from "./schema";
import { requireAllowed } from "@app/shared";
import type { Kind } from "./extract";
import {
  addDocument,
  createBase,
  deleteBase,
  deleteDocument,
  getDocument,
  listBases,
  listDocuments,
  reindexDocument,
  search,
} from "./service";

const kindOfFile = (name: string, type: string): Kind => {
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (type.includes("html") || /\.html?$/.test(name)) return "html";
  if (type.includes("markdown") || /\.(md|markdown)$/.test(name)) return "markdown";
  if (type.startsWith("text/") || name.endsWith(".txt")) return "text";
  throw invalid("Files can be PDF, Markdown, HTML or plain text.");
};

async function anyBase(ctx: AppContext, baseId: string) {
  const [base] = await ctx.db.select().from(bases).where(eq(bases.id, baseId));
  if (!base) throw notFound("Knowledge base");
  return base;
}

export function knowledgeRoutes(ctx: AppContext) {
  // The platform admin area: every knowledge base, with its Organization, and a search to try.
  const admin = new Elysia({ name: "knowledge.admin" }).group("/api/v1/admin/knowledge", (g) =>
    g
      .use(ctx.adminGuard!)
      .get(
        "/",
        () =>
          ctx.db
            .select({
              id: bases.id,
              name: bases.name,
              organizationId: bases.organizationId,
              organization: sql<string>`(select name from auth.organization o where o.id = "bases"."organization_id")`,
              embeddingModel: bases.embeddingModel,
              dimensions: bases.dimensions,
              documents: sql<number>`(select count(*)::int from knowledge.documents d where d.base_id = "bases"."id")`,
              failed: sql<number>`(select count(*)::int from knowledge.documents d where d.base_id = "bases"."id" and d.status = 'failed')`,
              chunks: sql<number>`(select count(*)::int from knowledge.chunks c where c.base_id = "bases"."id")`,
              createdAt: bases.createdAt,
            })
            .from(bases)
            .orderBy(bases.createdAt),
        { detail: { summary: "Every knowledge base, with its Organization and counts" } },
      )
      .post(
        "/bases",
        async ({ body }) => {
          const [org] = await ctx.db
            .select({ id: authOrganization.id })
            .from(authOrganization)
            .where(eq(authOrganization.id, body.organizationId));
          if (!org) throw notFound("Organization");
          return createBase(ctx, { orgId: body.organizationId, userId: null }, body);
        },
        {
          body: t.Object({
            organizationId: t.String(),
            name: t.String({ minLength: 1, maxLength: 120 }),
            embeddingModel: t.Optional(t.String()),
            dimensions: t.Optional(t.Integer()),
          }),
          detail: { summary: "Create a knowledge base for an Organization" },
        },
      )
      .get(
        "/bases/:baseId/documents",
        async ({ params }) => {
          const base = await anyBase(ctx, params.baseId);
          return listDocuments(ctx, base.organizationId, base.id);
        },
        { detail: { summary: "A knowledge base's documents" } },
      )
      .post(
        "/bases/:baseId/documents",
        async ({ params, body }) => {
          const base = await anyBase(ctx, params.baseId);
          return addDocument(ctx, { orgId: base.organizationId, userId: null }, base.id, body);
        },
        {
          body: t.Object({
            title: t.String({ minLength: 1, maxLength: 200 }),
            kind: t.Union([t.Literal("text"), t.Literal("markdown"), t.Literal("html"), t.Literal("url")]),
            content: t.Optional(t.String()),
            url: t.Optional(t.String()),
          }),
          detail: { summary: "Add a document to a knowledge base" },
        },
      )
      .post(
        "/search",
        async ({ body }) => {
          const base = await anyBase(ctx, body.baseId);
          return search(ctx, base.organizationId, [base.id], body.query, body.k ?? 5);
        },
        {
          body: t.Object({
            baseId: t.String({ format: "uuid" }),
            query: t.String({ minLength: 1, maxLength: 2000 }),
            k: t.Optional(t.Integer({ minimum: 1, maximum: 20 })),
          }),
          detail: { summary: "Try a search on a knowledge base" },
        },
      ),
  );
  const member = new Elysia({ name: "knowledge" }).group("/api/v1/organizations/:orgId/knowledge", (g) =>
    g
      .use(ctx.orgGuard!)
      .get(
        "/bases",
        ({ caller }) => {
          requireAllowed(caller, "knowledge", "view");
          return listBases(ctx, caller.orgId);
        },
        { detail: { summary: "List knowledge bases, with document and chunk counts" } },
      )
      .post(
        "/bases",
        ({ caller, body }) => {
          requireAllowed(caller, "knowledge", "manage");
          return createBase(ctx, caller, body);
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1, maxLength: 120 }),
            description: t.Optional(t.String({ maxLength: 500 })),
            embeddingModel: t.Optional(t.String()),
            dimensions: t.Optional(t.Integer()),
          }),
          detail: { summary: "Create a knowledge base, with its embedding model (default openai/text-embedding-3-small)" },
        },
      )
      .delete(
        "/bases/:baseId",
        async ({ caller, params }) => {
          requireAllowed(caller, "knowledge", "manage");
          await deleteBase(ctx, caller.orgId, params.baseId);
          return { ok: true };
        },
        { params: ids("baseId"), detail: { summary: "Delete a knowledge base, with its documents" } },
      )
      .get(
        "/bases/:baseId/documents",
        ({ caller, params }) => {
          requireAllowed(caller, "knowledge", "view");
          return listDocuments(ctx, caller.orgId, params.baseId);
        },
        { params: ids("baseId"), detail: { summary: "A knowledge base's documents and where each is in ingesting" } },
      )
      .post(
        "/bases/:baseId/documents",
        ({ caller, params, body }) => {
          requireAllowed(caller, "knowledge", "edit");
          return addDocument(ctx, caller, params.baseId, body);
        },
        {
          params: ids("baseId"),
          body: t.Object({
            title: t.String({ minLength: 1, maxLength: 200 }),
            kind: t.Union([t.Literal("text"), t.Literal("markdown"), t.Literal("html"), t.Literal("url")]),
            content: t.Optional(t.String()),
            url: t.Optional(t.String()),
          }),
          detail: { summary: "Add a document as text, Markdown, HTML, or a web page's URL; it's ingested in the background" },
        },
      )
      .post(
        "/bases/:baseId/files",
        async ({ caller, params, body }) => {
          requireAllowed(caller, "knowledge", "edit");
          const file = body.file;
          return addDocument(ctx, caller, params.baseId, {
            title: body.title || file.name,
            kind: kindOfFile(file.name.toLowerCase(), file.type),
            bytes: new Uint8Array(await file.arrayBuffer()),
          });
        },
        {
          params: ids("baseId"),
          body: t.Object({ file: t.File({ maxSize: "10m" }), title: t.Optional(t.String({ maxLength: 200 })) }),
          detail: { summary: "Upload a file (PDF, Markdown, HTML or text, up to 10 MB); it's ingested in the background" },
        },
      )
      .get(
        "/documents/:documentId",
        ({ caller, params }) => {
          requireAllowed(caller, "knowledge", "view");
          return getDocument(ctx, caller.orgId, params.documentId);
        },
        { params: ids("documentId"), detail: { summary: "A document and its ingesting status" } },
      )
      .post(
        "/documents/:documentId/reindex",
        async ({ caller, params }) => {
          requireAllowed(caller, "knowledge", "edit");
          await reindexDocument(ctx, caller.orgId, params.documentId);
          return { ok: true };
        },
        { params: ids("documentId"), detail: { summary: "Ingest a document again (a web page is fetched again)" } },
      )
      .delete(
        "/documents/:documentId",
        async ({ caller, params }) => {
          requireAllowed(caller, "knowledge", "edit");
          await deleteDocument(ctx, caller.orgId, params.documentId);
          return { ok: true };
        },
        { params: ids("documentId"), detail: { summary: "Remove a document and its chunks" } },
      )
      .post(
        "/search",
        ({ caller, body }) => {
          requireAllowed(caller, "knowledge", "view");
          return search(ctx, caller.orgId, body.baseIds, body.query, body.k);
        },
        {
          body: t.Object({
            baseIds: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 10 }),
            query: t.String({ minLength: 1, maxLength: 2000 }),
            k: t.Optional(t.Integer({ minimum: 1, maximum: 20 })),
          }),
          detail: { summary: "Search knowledge bases by meaning and by words (hybrid), best chunks first" },
        },
      ),
  );
  return new Elysia({ name: "knowledge.all" }).use(admin).use(member);
}
