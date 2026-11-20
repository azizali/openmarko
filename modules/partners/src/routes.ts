import { Elysia, t } from "elysia";
import { ids, unauthorized, type AppContext } from "@app/kernel";
import { getSession } from "@app/identity";
import { requireAllowed } from "@app/shared";
import { getOrganization } from "@app/organizations";
import * as svc from "./service";
import { brandFor, brandOwnerOf, setBrand } from "./brand";

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function partnerRoutes(ctx: AppContext) {
  const orgGuard = ctx.orgGuard!;
  const routes = new Elysia({ name: "partners" }).group("/api/v1/organizations/:orgId", (g) =>
    g
      .use(orgGuard)
      // Whether this Organization may act as a Partner, and its Clients.
      .get(
        "/partner",
        async ({ caller }) => ({ partner: await svc.isPartnerPlan(ctx, caller.orgId), clients: await svc.listClients(ctx, caller.orgId) }),
        { detail: { summary: "Whether this organization is a Partner, and its Clients" } },
      )
      // A Partner creates an Organization as its Client (ADR 0023).
      .post(
        "/clients",
        async ({ caller, body, request }) => {
          requireAllowed(caller, "organization", "update");
          return svc.createClient(ctx, caller, request.headers, body);
        },
        {
          detail: { summary: "Create an organization as this partner's client" },
          body: t.Object({
            name: t.String({ minLength: 1, maxLength: 120 }),
            slug: t.String({ pattern: "^[a-z0-9-]{2,40}$" }),
            timezone: t.String({ minLength: 1 }),
          }),
        },
      )
      // Transfer out: this Organization is the Client. Owner only, with a preview first (ADR 0011).
      .get(
        "/transfer-out",
        async ({ caller }) => {
          requireAllowed(caller, "organization", "delete");
          return svc.transferOutPreview(ctx, caller.orgId);
        },
        { detail: { summary: "Preview a transfer-out: Partner members and what changes" } },
      )
      .post(
        "/transfer-out",
        async ({ caller, body }) => {
          requireAllowed(caller, "organization", "delete");
          await svc.transferOut(ctx, caller, caller.orgId, body.revokeUserIds);
          return { ok: true };
        },
        {
          detail: { summary: "Transfer this client out of its partner (owner only)" },
          body: t.Object({ revokeUserIds: t.Array(t.String({ format: "uuid" })) }),
        },
      ),
  );
  // The Partners the signed-in person works at, whichever Organization they have open.
  const myPartners = new Elysia({ name: "partners.mine" }).get(
    "/api/v1/me/partners",
    async ({ request }) => {
      const session = await getSession(ctx, request.headers);
      if (!session) throw unauthorized();
      return svc.partnersOf(ctx, session.userId);
    },
    { detail: { summary: "List the partners you work at" } },
  );
  // The Partner's own brand, edited by people who may change organization settings on it.
  const brandEdit = new Elysia({ name: "partners.brand-edit" }).group("/api/v1/organizations/:orgId/brand", (g) =>
    g
      .use(orgGuard)
      .get("/", ({ caller }) => brandFor(ctx, caller.orgId), { detail: { summary: "Get this partner's brand" } })
      // What this Organization's Members see away from a Partner's host: any Member may ask.
      .get(
        "/applied",
        async ({ caller }) => {
          const partnerId = await brandOwnerOf(ctx, await getOrganization(ctx, caller.orgId));
          return { partnerId, whitelabel: partnerId !== null, brand: await brandFor(ctx, partnerId) };
        },
        { detail: { summary: "Get the brand this organization's members see" } },
      )
      .put(
        "/",
        async ({ caller, body }) => {
          requireAllowed(caller, "organization", "update");
          await setBrand(ctx, caller.orgId, body, caller.userId);
          return { ok: true };
        },
        { detail: { summary: "Set this partner's brand" }, params: ids() },
      ),
  );
  return routes.use(myPartners).use(brandEdit);
}
