import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { authMember, authOrganization, ids, unauthorized, type AppContext } from "@app/kernel";
import { getSession } from "@app/identity";
import { requireAllowed } from "@app/shared";
import * as svc from "./service";
import { createOrganization, listOrganizations } from "./admin";

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function organizationRoutes(ctx: AppContext) {
  const orgGuard = ctx.orgGuard!;
  const routes = new Elysia({ name: "organizations" })
    // The Organizations I belong to (the switcher).
    .get(
      "/api/v1/me/organizations",
      async ({ request }) => {
        const session = await getSession(ctx, request.headers);
        if (!session) throw unauthorized();
        return ctx.db
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
          .where(and(eq(authMember.userId, session.userId)))
          .orderBy(authOrganization.name);
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
            return { id: org.id, name: org.name, slug: org.slug, timezone: org.timezone, partnerId: org.partnerId, role: caller.role };
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
              name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
              timezone: t.Optional(t.String({ maxLength: 60 })),
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
        // People (roles come from the access module; invitations are Better Auth's endpoints under /api/auth).
        .get("/members", ({ caller }) => svc.listMembers(ctx, caller.orgId), { detail: { summary: "List members and their roles" } })
        .get(
          "/invitations",
          ({ caller }) => {
            requireAllowed(caller, "invitation", "create");
            return svc.listPendingInvitations(ctx, caller.orgId);
          },
          { detail: { summary: "Invitations still waiting to be accepted" } },
        )
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
  // The platform admin area: every Organization with its Owner's status, and creating one with its first Owner.
  const admin = new Elysia({ name: "organizations.admin" }).group("/api/v1/admin/organizations", (g) =>
    g
      .use(ctx.adminGuard!)
      .get("/", () => listOrganizations(ctx), { detail: { summary: "Every Organization, with member counts and the Owner's status" } })
      .post("/", ({ admin, body }) => createOrganization(ctx, { ...body, by: admin }), {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 120 }),
          slug: t.String({ minLength: 2, maxLength: 40 }),
          ownerEmail: t.String({ format: "email", maxLength: 254 }),
        }),
        detail: { summary: "Create an Organization with its first Owner (added, or invited by email)" },
      }),
  );
  return routes.use(admin);
}
