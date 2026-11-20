import { defineModule } from "@app/kernel";
import { accessRoutes } from "./routes";

/**
 * Access: Roles, permissions and the caller guard. The routes for People live with the Organization
 * (organizations module); this module serves Roles and "who am I here".
 */
export const accessModule = defineModule({
  id: "access",
  apiGroup: { name: "Access", description: "Custom roles and their permissions." },
  dependsOn: ["identity"],
  setup: (ctx) => ({ routes: accessRoutes(ctx) }),
});
