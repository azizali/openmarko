import { and, eq } from "drizzle-orm";
import { authMember, authOrganization, forbidden, notFound, unauthorized, type AppContext } from "@openmarko/kernel";
import { getSession } from "@openmarko/identity";
import type { Caller } from "@openmarko/shared";
import { permissionFor } from "./permissions";

/**
 * Resolves the caller for an Organization. The caller must hold a member row there (ADR 0011).
 * Archived Organizations accept nobody.
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

  return {
    userId: session.userId,
    orgId: targetOrg,
    role: member.role,
    permission: await permissionFor(ctx, targetOrg, member.role),
  };
}
