import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { authMember, authOrganization, defineModule, ids, unauthorized, type AppContext } from "@openmarko/kernel";
import { getSession } from "@openmarko/identity";
import { requireAllowed } from "@openmarko/shared";
import * as svc from "./service";
import { brandFor, setBrand } from "./brand";

/**
 * The Location fields a person may set. Ids, the Google Business Profile link and archive state are not here:
 * they change only through their own flows (connect, archive), never through a body.
 */
const nullableText = t.Optional(t.Union([t.String({ maxLength: 200 }), t.Null()]));
const locationFields = {
  addressLine1: nullableText,
  addressLine2: nullableText,
  city: nullableText,
  region: nullableText,
  postalCode: nullableText,
  country: t.Optional(t.String({ minLength: 2, maxLength: 2 })),
  lat: t.Optional(t.Union([t.Number({ minimum: -90, maximum: 90 }), t.Null()])),
  lng: t.Optional(t.Union([t.Number({ minimum: -180, maximum: 180 }), t.Null()])),
  phone: nullableText,
  timezone: nullableText,
  placeId: nullableText,
  websiteUrl: t.Optional(t.Union([t.String({ format: "uri" }), t.Null()])),
};
const newLocation = t.Object({ name: t.String({ minLength: 1, maxLength: 120 }), ...locationFields });
const locationPatch = t.Object({ name: t.Optional(t.String({ minLength: 1, maxLength: 120 })), ...locationFields });

export const organizationsModule = defineModule({
  id: "organizations",
  dependsOn: ["identity", "access", "billing", "features"],
  setup: (ctx) => ({ routes: organizationRoutes(ctx) }),
});

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function organizationRoutes(ctx: AppContext) {
  const orgGuard = ctx.orgGuard!;
  const routes = new Elysia({ name: "organizations" })
    // The Organizations I belong to (the switcher).
    .get(
      "/api/v1/me/organizations",
      async ({ headers }) => {
        const session = await getSession(ctx, new Headers(headers as Record<string, string>));
        if (!session) throw unauthorized();
        const rows = await ctx.db
          .select({
            id: authOrganization.id,
            name: authOrganization.name,
            slug: authOrganization.slug,
            role: authMember.role,
            archivedAt: authOrganization.archivedAt,
            partnerId: authOrganization.partnerId,
          })
          .from(authMember)
          .innerJoin(authOrganization, eq(authOrganization.id, authMember.organizationId))
          .where(eq(authMember.userId, session.userId));
        return rows;
      },
      { detail: { summary: "List the organizations you belong to" } },
    )
    .group("/api/v1/organizations/:orgId", (g) =>
      g
        .use(orgGuard)
        .get(
          "/",
          async ({ caller }) => {
            const org = await svc.getOrganization(ctx, caller.orgId);
            return {
              id: org.id,
              name: org.name,
              slug: org.slug,
              category: org.category,
              timezone: org.timezone,
              partnerId: org.partnerId,
              role: caller.role,
            };
          },
          { detail: { summary: "Get this organization" } },
        )
        .patch(
          "/",
          async ({ caller, body }) => {
            requireAllowed(caller, "organization", "update");
            await svc.updateOrganization(ctx, caller, body);
            return { ok: true };
          },
          {
            detail: { summary: "Update organization settings" },
            body: t.Object({
              name: t.Optional(t.String({ minLength: 1 })),
              category: t.Optional(t.Union([t.String(), t.Null()])),
              timezone: t.Optional(t.String()),
            }),
          },
        )
        // Archive and delete are Owner only (organization.delete is owner-only in the access model).
        .post(
          "/archive",
          async ({ caller }) => {
            requireAllowed(caller, "organization", "delete");
            await svc.archiveOrganization(ctx, caller, true);
            return { ok: true };
          },
          { detail: { summary: "Archive this organization (owner only)" } },
        )
        .post(
          "/unarchive",
          async ({ caller }) => {
            requireAllowed(caller, "organization", "delete");
            await svc.archiveOrganization(ctx, caller, false);
            return { ok: true };
          },
          { detail: { summary: "Unarchive this organization (owner only)" } },
        )
        .delete(
          "/",
          async ({ caller }) => {
            requireAllowed(caller, "organization", "delete");
            await svc.hardDeleteOrganization(ctx, caller);
            return { ok: true };
          },
          { detail: { summary: "Delete this organization (after archiving; owner only)" } },
        )
        // Locations
        .get(
          "/locations",
          async ({ caller }) => {
            requireAllowed(caller, "setup", "view");
            return svc.listLocations(ctx, caller.orgId);
          },
          { detail: { summary: "List locations" } },
        )
        .post(
          "/locations",
          async ({ caller, body }) => {
            requireAllowed(caller, "setup", "connect");
            return { id: await svc.createLocation(ctx, caller, body) };
          },
          { detail: { summary: "Add a location" }, body: newLocation },
        )
        .patch(
          "/locations/:locationId",
          async ({ caller, params, body }) => {
            requireAllowed(caller, "setup", "connect");
            await svc.updateLocation(ctx, caller, params.locationId, body);
            return { ok: true };
          },
          { detail: { summary: "Update a location" }, params: ids("locationId"), body: locationPatch },
        )
        .post(
          "/locations/:locationId/archive",
          async ({ caller, params }) => {
            requireAllowed(caller, "setup", "connect");
            await svc.archiveLocation(ctx, caller, params.locationId);
            return { ok: true };
          },
          { detail: { summary: "Archive a location" }, params: ids("locationId") },
        )
        // Websites
        .get(
          "/websites",
          async ({ caller }) => {
            requireAllowed(caller, "setup", "view");
            return svc.listWebsites(ctx, caller.orgId);
          },
          { detail: { summary: "List websites" } },
        )
        .post(
          "/websites",
          async ({ caller, body }) => {
            requireAllowed(caller, "setup", "connect");
            return { id: await svc.addWebsite(ctx, caller, body.domain) };
          },
          { detail: { summary: "Add a website" }, body: t.Object({ domain: t.String({ minLength: 1 }) }) },
        )
        .post(
          "/websites/:websiteId/archive",
          async ({ caller, params }) => {
            requireAllowed(caller, "setup", "connect");
            await svc.archiveWebsite(ctx, caller, params.websiteId);
            return { ok: true };
          },
          { detail: { summary: "Archive a website" }, params: ids("websiteId") },
        )
        // Partner: asks a Client to take it on. The Client's owner decides (ADR 0011).
        .post(
          "/clients",
          async ({ caller, body }) => {
            requireAllowed(caller, "organization", "update");
            return { requestId: await svc.requestClient(ctx, caller, body.clientId) };
          },
          { detail: { summary: "Ask a client to take this partner on" }, body: t.Object({ clientId: t.String({ format: "uuid" }) }) },
        )
        .get(
          "/partner-requests",
          async ({ caller }) => {
            return svc.listPartnerRequests(ctx, caller.orgId, "partner");
          },
          { detail: { summary: "List partner requests sent or received" } },
        )
        // Client: the owner accepts or declines a Partner's request.
        .post(
          "/partner-requests/:requestId/respond",
          async ({ caller, params, body }) => {
            requireAllowed(caller, "organization", "delete");
            await svc.respondToPartnerRequest(ctx, caller, params.requestId, body.accept);
            return { ok: true };
          },
          {
            detail: { summary: "Accept or decline a partner's request (client owner)" },
            params: ids("requestId"),
            body: t.Object({ accept: t.Boolean() }),
          },
        )
        // Whitelabel: hosts that show this Partner's brand.
        .post(
          "/domains",
          async ({ caller, body }) => {
            requireAllowed(caller, "organization", "update");
            await svc.addDomain(ctx, caller, body.host);
            return { ok: true };
          },
          { detail: { summary: "Add a host that shows this partner's brand" }, body: t.Object({ host: t.String({ minLength: 3 }) }) },
        )
        // Transfer out: this Organization is the Client. Owner only, with a preview first (ADR 0011).
        .get(
          "/transfer-out",
          async ({ caller }) => {
            requireAllowed(caller, "organization", "delete");
            return svc.transferOutPreview(ctx, caller.orgId);
          },
          { detail: { summary: "Preview a transfer-out: agency members and what changes" } },
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
        )
        // People (roles come from the access module; invitations are Better Auth's endpoints under /api/auth).
        .get("/members", ({ caller }) => svc.listMembers(ctx, caller.orgId), { detail: { summary: "List members and their roles" } })
        .patch(
          "/members/:userId",
          async ({ caller, params, body }) => {
            requireAllowed(caller, "member", "update");
            await svc.changeMemberRole(ctx, caller, params.userId, body.role);
            return { ok: true };
          },
          { detail: { summary: "Change a member's role" }, params: ids("userId"), body: t.Object({ role: t.String({ minLength: 1 }) }) },
        )
        .delete(
          "/members/:userId",
          async ({ caller, params }) => {
            requireAllowed(caller, "member", "delete");
            await svc.removeMember(ctx, caller, params.userId);
            return { ok: true };
          },
          { detail: { summary: "Remove a member" }, params: ids("userId") },
        ),
    );
  // The brand for the host a request arrives on. Open: it's shown before anyone signs in.
  const brand = new Elysia({ name: "organizations.brand" }).get(
    "/api/v1/brand",
    async ({ request }) => {
      const partnerId = await svc.partnerForHost(ctx, new URL(request.url).host);
      return { partnerId, whitelabel: partnerId !== null, brand: await brandFor(ctx, partnerId) };
    },
    { detail: { summary: "Get the brand for the host the request arrives on" } },
  );
  // The Partner's own brand, edited by people who may change organization settings on it.
  const brandEdit = new Elysia({ name: "organizations.brand-edit" }).group("/api/v1/organizations/:orgId/brand", (g) =>
    g
      .use(orgGuard)
      .get("/", async ({ caller }) => brandFor(ctx, caller.orgId), { detail: { summary: "Get this partner's brand" } })
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
  return routes.use(brand).use(brandEdit);
}
