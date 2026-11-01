import { and, eq } from "drizzle-orm";
import { newId, type AppContext } from "@openmarko/kernel";
import { invoke } from "@openmarko/integrations";
import { citations } from "./schema";
import { activeLocation } from "./locations";

/** Directories checked for each Location. The product plans 18; this is the first set (roadmap). */
export const directories = ["yelp.com", "facebook.com", "bbb.org", "yellowpages.com", "mapquest.com", "foursquare.com"] as const;

export async function listCitations(ctx: AppContext, orgId: string, locationId: string) {
  await activeLocation(ctx, orgId, locationId);
  return ctx.db
    .select()
    .from(citations)
    .where(and(eq(citations.organizationId, orgId), eq(citations.locationId, locationId)));
}

/** Looks for the Location's listing on each directory with a site-restricted search for its name. */
export async function checkCitations(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  runId: string | null = null,
): Promise<{ found: number; missing: number }> {
  const loc = await activeLocation(ctx, orgId, locationId);
  let found = 0;
  let missing = 0;
  for (const dir of directories) {
    const { output } = await invoke<{ domain: string; url: string }[]>(
      ctx,
      orgId,
      "serp.read",
      { kind: "organic", keyword: `site:${dir} "${loc.name}"`, domain: dir },
      { runId },
    );
    const hit = output.find((i) => i.domain === dir);
    const status = hit ? "found" : "missing";
    if (hit) found++;
    else missing++;
    await ctx.db
      .insert(citations)
      .values({ id: newId(), organizationId: orgId, locationId, directory: dir, status, url: hit?.url ?? null })
      .onConflictDoUpdate({
        target: [citations.locationId, citations.directory],
        set: { status, url: hit?.url ?? null, checkedAt: new Date() },
      });
  }
  return { found, missing };
}
