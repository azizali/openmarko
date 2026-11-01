import { and, eq, isNull, sql } from "drizzle-orm";
import { needs, type AppContext } from "@openmarko/kernel";
import { connections } from "../schema";
import { invoke } from "../service";
import { siteSpecs } from "./registry";
import type { InputOf, SiteOp, SiteOutput } from "./contract";

/** The CMS connection of one website. A CMS attaches to a website, so there's no organization-wide fallback. */
export async function websiteConnection(ctx: AppContext, orgId: string, websiteId: string) {
  const [c] = await ctx.db
    .select({ id: connections.id, providerId: connections.providerId, settings: connections.settings })
    .from(connections)
    .where(
      and(
        eq(connections.organizationId, orgId),
        eq(connections.targetType, "website"),
        eq(connections.targetId, websiteId),
        sql`${connections.capabilities} @> ARRAY['site.write']::text[]`,
        isNull(connections.revokedAt),
      ),
    )
    .orderBy(sql`created_at desc`)
    .limit(1);
  return c ?? null;
}

/** Whether the website's CMS can do an op. Null when no CMS is connected (the feature should say Connect). */
export async function siteSupports(ctx: AppContext, orgId: string, websiteId: string, op: SiteOp): Promise<boolean | null> {
  const conn = await websiteConnection(ctx, orgId, websiteId);
  if (!conn) return null;
  const spec = siteSpecs.find((s) => s.provider === conn.providerId);
  return spec ? spec.supports(op, conn.settings) : false;
}

/**
 * Runs one CMS-contract op on a website, through its own connection. Throws needs("site.write") when none is
 * connected, and 409 unsupported_by_cms when the connected CMS can't do the op.
 */
export async function siteCall<O extends SiteOp>(ctx: AppContext, orgId: string, websiteId: string, input: InputOf<O>): Promise<SiteOutput[O]> {
  const conn = await websiteConnection(ctx, orgId, websiteId);
  if (!conn) throw needs("site.write");
  const { output } = await invoke<SiteOutput[O]>(ctx, orgId, "site.write", input, { connectionId: conn.id });
  return output;
}
