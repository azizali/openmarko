// Turning a Role into what a Member may do, and checking it (ADR 0003, ADR 0012).
// The permission is: the Role's grant over the enabled modules' resources, minus any Action the Plan removes.
import { and, eq } from "drizzle-orm";
import { authOrganizationRole, billingOf, catalogOf, type AccessCatalog, type AppContext, type Entitlements } from "@app/kernel";
import { compile, presets, allows, allowsAll, type Permission, type Resource, type RoleSpec } from "@app/shared";

const presetById = new Map(presets.map((p) => [p.id, p]));

/** What Roles are built from: the permission resources and groups of the enabled modules. */
export function accessFor(ctx: AppContext): AccessCatalog {
  const { resources, groups } = catalogOf(ctx);
  return { resources, groups };
}

/** The grant a Role gives, before any Plan changes. Presets come from code; custom roles from the database. */
export async function grantFor(ctx: AppContext, access: AccessCatalog, orgId: string, role: string): Promise<Permission> {
  const preset = presetById.get(role);
  if (preset) return compile(access, preset);
  const [row] = await ctx.db
    .select({ permission: authOrganizationRole.permission, spec: authOrganizationRole.spec })
    .from(authOrganizationRole)
    .where(and(eq(authOrganizationRole.organizationId, orgId), eq(authOrganizationRole.role, role)));
  if (!row) return {};
  // Recompiled from the saved spec, so a module added later reaches every custom role without an edit (ADR 0003).
  if (row.spec) return compile(access, row.spec as unknown as RoleSpec);
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
export async function permissionFor(ctx: AppContext, access: AccessCatalog, orgId: string, role: string): Promise<Permission> {
  const [grant, ent] = await Promise.all([grantFor(ctx, access, orgId, role), billingOf(ctx).entitlementsFor(orgId)]);
  return applyPlan(grant, ent);
}

export { allows, allowsAll };
export type { RoleSpec };
