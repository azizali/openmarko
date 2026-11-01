// Turning a Role into what a Member may do, and checking it (ADR 0003, ADR 0012).
// The permission is: the Role's grant, minus any Action the Plan removes.
import { and, eq } from "drizzle-orm";
import { authOrganizationRole } from "@openmarko/kernel";
import { compile, presets, allows, allowsAll, type Permission, type Resource, type RoleSpec } from "@openmarko/shared";
import type { AppContext } from "@openmarko/kernel";
import { entitlementsFor, type Entitlements } from "@openmarko/billing";

const presetById = new Map(presets.map((p) => [p.id, p]));

/** The grant a Role gives, before any Plan changes. Presets come from code; custom roles from the database. */
export async function grantFor(ctx: AppContext, orgId: string, role: string): Promise<Permission> {
  const preset = presetById.get(role);
  if (preset) return compile(preset);
  const [row] = await ctx.db
    .select({ permission: authOrganizationRole.permission, spec: authOrganizationRole.spec })
    .from(authOrganizationRole)
    .where(and(eq(authOrganizationRole.organizationId, orgId), eq(authOrganizationRole.role, role)));
  if (!row) return {};
  // Recompiled from the saved spec, so a feature added later reaches every custom role without an edit (ADR 0003).
  if (row.spec) return compile(row.spec as unknown as RoleSpec);
  return JSON.parse(row.permission) as Permission;
}

/** Removes the Actions the Plan takes away: `action.<resource>.<action> = 0` (ADR 0012). */
export function applyPlan(grant: Permission, ent: Entitlements): Permission {
  const out: Permission = {};
  for (const [r, acts] of Object.entries(grant) as [Resource, string[]][]) {
    const kept = acts.filter((a) => ent.get(`action.${r}.${a}`) !== 0);
    if (kept.length) out[r] = kept;
  }
  return out;
}

/** The full permission a Member has in an Organization. */
export async function permissionFor(ctx: AppContext, orgId: string, role: string): Promise<Permission> {
  const [grant, ent] = await Promise.all([grantFor(ctx, orgId, role), entitlementsFor(ctx, orgId)]);
  return applyPlan(grant, ent);
}

export { allows, allowsAll };
export type { RoleSpec };
