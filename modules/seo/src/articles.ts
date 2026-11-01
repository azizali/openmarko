import { and, desc, eq } from "drizzle-orm";
import { conflict, newId, notFound, type AppContext } from "@openmarko/kernel";
import { invoke, siteCall } from "@openmarko/integrations";
import { articles } from "./schema";
import { activeWebsite } from "./locations";

export async function listArticles(ctx: AppContext, orgId: string, websiteId: string) {
  await activeWebsite(ctx, orgId, websiteId);
  return ctx.db
    .select()
    .from(articles)
    .where(and(eq(articles.organizationId, orgId), eq(articles.websiteId, websiteId)))
    .orderBy(desc(articles.createdAt));
}

/** Drafts an article for a keyword on a website. The draft is stored; nothing is published here. */
export async function draftArticle(
  ctx: AppContext,
  orgId: string,
  websiteId: string,
  keyword: string,
  userId: string | null,
): Promise<string> {
  const site = await activeWebsite(ctx, orgId, websiteId);
  const prompt = `Write a helpful article for ${site.domain} about "${keyword}". Start with a title line, then the body in short paragraphs.`;
  const { output } = await invoke<{ text: string }>(ctx, orgId, "llm.complete", { prompt });
  const [titleLine, ...rest] = output.text.split("\n").filter(Boolean);
  const id = newId();
  await ctx.db.insert(articles).values({
    id,
    organizationId: orgId,
    websiteId,
    keyword,
    title: (titleLine ?? keyword).replace(/^#+\s*/, ""),
    body: rest.join("\n\n") || output.text,
    status: "draft",
    createdBy: userId,
  });
  return id;
}

/**
 * Publishes through the article's own website's CMS (ADR 0016). Without a CMS connected this says Connect;
 * the CMS's id and URL for the post are kept, so the article links to where it went live.
 */
export async function publishArticle(ctx: AppContext, orgId: string, articleId: string): Promise<void> {
  const [a] = await ctx.db
    .select()
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.organizationId, orgId)));
  if (!a) throw notFound("Article");
  if (a.status === "published") throw conflict("This article is already published.");
  const out = await siteCall(ctx, orgId, a.websiteId, { op: "publishArticle", title: a.title, body: a.body });
  await ctx.db
    .update(articles)
    .set({ status: "published", publishedAt: new Date(), externalId: out.externalId, publishedUrl: out.url })
    .where(eq(articles.id, articleId));
}
