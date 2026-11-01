import { Elysia, t } from "elysia";
import { defineModule, invalid, type AppContext } from "@openmarko/kernel";
import { entitlementsFor } from "@openmarko/billing";
import { requireAllowed, features } from "@openmarko/shared";
import { allStatuses } from "./status";
import { authOrganization } from "@openmarko/kernel";
import { eq } from "drizzle-orm";

export const featuresModule = defineModule({
  id: "features",
  dependsOn: ["billing"],
  setup: (ctx) => ({ routes: featureRoutes(ctx) }),
});

async function orgFeatures(ctx: AppContext, orgId: string): Promise<Record<string, boolean>> {
  const [row] = await ctx.db.select({ features: authOrganization.features }).from(authOrganization).where(eq(authOrganization.id, orgId));
  return (row?.features as Record<string, boolean>) ?? {};
}

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function featureRoutes(ctx: AppContext) {
  const routes = new Elysia({ name: "features" }).group("/api/v1/organizations/:orgId/features", (g) =>
    g
      .use(ctx.orgGuard!)
      .get(
        "/",
        async ({ caller }) => {
          requireAllowed(caller, "setup", "view");
          return allStatuses(await orgFeatures(ctx, caller.orgId), await entitlementsFor(ctx, caller.orgId));
        },
        { detail: { summary: "Get each feature's status and why it is on or off" } },
      )
      .patch(
        "/",
        async ({ caller, body }) => {
          requireAllowed(caller, "organization", "update");
          const known = new Set(features.map((f) => f.id));
          const next = { ...(await orgFeatures(ctx, caller.orgId)) };
          for (const [id, on] of Object.entries(body)) {
            if (!known.has(id as never)) throw invalid(`Unknown feature "${id}".`);
            next[id] = on;
          }
          await ctx.db.update(authOrganization).set({ features: next }).where(eq(authOrganization.id, caller.orgId));
          return allStatuses(next, await entitlementsFor(ctx, caller.orgId));
        },
        { detail: { summary: "Switch features on or off for this organization" }, body: t.Record(t.String(), t.Boolean()) },
      ),
  );
  return routes;
}
