import { Elysia } from "elysia";
import { catalogOf, describeCatalog, type AppContext } from "@app/kernel";
import { presets, requireAllowed } from "@app/shared";
import { saveRole, deleteRole, listRoles } from "./roles";

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function accessRoutes(ctx: AppContext) {
  // Who the caller is in this Organization: their Role and what it allows. The web app reads this once per
  // Organization to show and hide what the person may do.
  const whoAmI = new Elysia({ name: "access.caller" }).group("/api/v1/organizations/:orgId", (g) =>
    g
      .use(ctx.orgGuard!)
      .get("/caller", ({ caller }) => ({ userId: caller.userId, orgId: caller.orgId, role: caller.role, permission: caller.permission }), {
        detail: { summary: "Who you are in this Organization: your Role and what it allows" },
      }),
  );
  // What Roles are made of: the resources, actions and groups of the enabled modules, and the built-in Roles.
  // Open to any signed-in member (it names nothing private); the Role editor renders from it.
  const catalog = new Elysia({ name: "access.catalog" }).group("/api/v1/organizations/:orgId/roles", (g) =>
    g.use(ctx.orgGuard!).get(
      "/catalog",
      () => {
        const { resources, groups } = describeCatalog(catalogOf(ctx));
        return { resources, groups, presets };
      },
      { detail: { summary: "What a Role can cover: every resource, action and group, plus the built-in Roles" } },
    ),
  );
  // Custom Roles: the owner's Roles in this Organization. Editing a role needs ac.* permission (ADR 0003).
  const routes = new Elysia({ name: "access.roles" }).group("/api/v1/organizations/:orgId/roles", (g) =>
    g
      .use(ctx.orgGuard!)
      .get(
        "/",
        async ({ caller }) => {
          requireAllowed(caller, "ac", "read");
          return listRoles(ctx, caller.orgId);
        },
        { detail: { summary: "List custom roles" } },
      )
      .post(
        "/:role",
        async ({ caller, params, body }) => {
          requireAllowed(caller, "ac", "create");
          return { id: await saveRole(ctx, caller.access, caller.orgId, params.role, body, false) };
        },
        { detail: { summary: "Create a custom role" } },
      )
      .put(
        "/:role",
        async ({ caller, params, body }) => {
          requireAllowed(caller, "ac", "update");
          await saveRole(ctx, caller.access, caller.orgId, params.role, body, true);
          return { ok: true };
        },
        { detail: { summary: "Update a custom role" } },
      )
      .delete(
        "/:role",
        async ({ caller, params }) => {
          requireAllowed(caller, "ac", "delete");
          await deleteRole(ctx, caller.orgId, params.role);
          return { ok: true };
        },
        { detail: { summary: "Delete a custom role" } },
      ),
  );
  return new Elysia({ name: "access" }).use(whoAmI).use(catalog).use(routes);
}
