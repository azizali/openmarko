import { and, eq } from "drizzle-orm";
import { authMember, authOrganization, forbidden, notFound, unauthorized, type AppContext, type Caller } from "@app/kernel";
import { getSession } from "@app/identity";
import { accessFor, permissionFor } from "./permissions";

/**
 * Resolves the caller for an Organization. The caller must hold a member row there (ADR 0011). Archived Organizations
 * accept nobody. The permission is compiled against the catalog: only resources the enabled modules declare.
 */
export async function callerFor(ctx: AppContext, headers: Headers, orgId?: string | null): Promise<Caller> {
  const session = await getSession(ctx, headers);
  if (!session) throw unauthorized();
  const targetOrg = orgId ?? session.activeOrganizationId;
  if (!targetOrg) throw notFound("Organization");

  const [member] = await ctx.db
    .select({ role: authMember.role })
    .from(authMember)
    .where(and(eq(authMember.organizationId, targetOrg), eq(authMember.userId, session.userId)));
  if (!member) throw forbidden("You are not a member of this organization.");

  const [org] = await ctx.db
    .select({ archivedAt: authOrganization.archivedAt })
    .from(authOrganization)
    .where(eq(authOrganization.id, targetOrg));
  if (!org) throw notFound("Organization");
  if (org.archivedAt) throw forbidden("This organization is archived.");

  const access = accessFor(ctx);
  return {
    userId: session.userId,
    orgId: targetOrg,
    role: member.role,
    permission: await permissionFor(ctx, access, targetOrg, member.role),
    access,
  };
}
