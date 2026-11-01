import { Elysia } from "elysia";
import { defineModule, type AppContext } from "@openmarko/kernel";
import { requireAllowed } from "@openmarko/shared";
import { saveRole, deleteRole, listRoles } from "./roles";

/**
 * Access: Roles, permissions and the caller guard. The routes for Roles and People live with the
 * Organization (organizations module), so this module has no routes of its own.
 */
export const accessModule = defineModule({
  id: "access",
  dependsOn: ["identity", "billing"],
  setup: (ctx) => ({ routes: accessRoutes(ctx) }),
});

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function accessRoutes(ctx: AppContext) {
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
          return { id: await saveRole(ctx, caller.orgId, params.role, body, false) };
        },
        { detail: { summary: "Create a custom role" } },
      )
      .put(
        "/:role",
        async ({ caller, params, body }) => {
          requireAllowed(caller, "ac", "update");
          await saveRole(ctx, caller.orgId, params.role, body, true);
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
  return routes;
}
