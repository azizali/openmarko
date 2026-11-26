import { orgGuardFrom, type AppContext } from "@app/kernel";
import { callerFor } from "./caller";

/**
 * The caller guard for routes under /organizations/:orgId. Composed once at boot by the server package and handed
 * to modules as ctx.orgGuard.
 */
export function orgGuardPlugin(ctx: AppContext) {
  return orgGuardFrom((headers, orgId) => callerFor(ctx, headers, orgId));
}
