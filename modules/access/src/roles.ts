// Custom Roles (ADR 0003): a RoleSpec the editor saves, compiled to Better Auth's permission shape and stored beside it.
// Specs are checked against the catalog: a Role can only name what the enabled modules offer.
import { and, eq } from "drizzle-orm";
import { authOrganizationRole, conflict, invalid, notFound, newId, type AccessCatalog, type AppContext } from "@app/kernel";
import { compile, presets, type RoleSpec } from "@app/shared";
import { z } from "zod";

const levels = ["none", "view", "edit", "publish", "manage"] as const;

/** The spec the editor sends. Resources, groups and actions are checked against the Project's catalog. */
export const roleSpecSchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(200).default(""),
  base: z.enum(levels),
  groups: z.record(z.string(), z.enum(levels)).default({}),
  resources: z.record(z.string(), z.union([z.enum(levels), z.array(z.string())])).default({}),
});

const presetIds = new Set(presets.map((p) => p.id));

/** Validates a spec and turns it into a RoleSpec. Unknown resources, groups or actions are refused, not ignored. */
export function toRoleSpec(access: AccessCatalog, id: string, input: unknown): RoleSpec {
  const parsed = roleSpecSchema.safeParse(input);
  if (!parsed.success) throw invalid("That role isn't valid.", { issues: parsed.error.issues });
  const groupIds = new Set(access.groups.map((g) => g.id));
  for (const g of Object.keys(parsed.data.groups)) if (!groupIds.has(g)) throw invalid(`Unknown group ${g}.`);
  for (const [r, v] of Object.entries(parsed.data.resources)) {
    const resource = access.resources.find((x) => x.id === r);
    if (!resource) throw invalid(`Unknown resource ${r}.`);
    if (Array.isArray(v)) {
      const unknown = v.filter((a) => !resource.actions.some((x) => x.id === a));
      if (unknown.length) throw invalid(`Unknown actions for ${r}: ${unknown.join(", ")}`);
    }
  }
  return { id, ...parsed.data } as RoleSpec;
}

export async function saveRole(ctx: AppContext, access: AccessCatalog, orgId: string, roleName: string, input: unknown, updating: boolean) {
  if (presetIds.has(roleName.toLowerCase())) throw conflict("That name is a built-in role.");
  const spec = toRoleSpec(access, roleName, input);
  const permission = JSON.stringify(compile(access, spec));
  const [existing] = await ctx.db
    .select({ id: authOrganizationRole.id })
    .from(authOrganizationRole)
    .where(and(eq(authOrganizationRole.organizationId, orgId), eq(authOrganizationRole.role, roleName)));
  if (updating && !existing) throw notFound("Role");
  if (!updating && existing) throw conflict("A role with that name already exists.");
  if (existing) {
    await ctx.db
      .update(authOrganizationRole)
      .set({ permission, spec: spec as unknown as Record<string, unknown> })
      .where(eq(authOrganizationRole.id, existing.id));
    return existing.id;
  }
  const id = newId();
  await ctx.db.insert(authOrganizationRole).values({
    id,
    organizationId: orgId,
    role: roleName,
    permission,
    spec: spec as unknown as Record<string, unknown>,
  });
  return id;
}

export async function deleteRole(ctx: AppContext, orgId: string, roleName: string): Promise<void> {
  const { authMember } = await import("@app/kernel");
  const [inUse] = await ctx.db
    .select({ id: authMember.id })
    .from(authMember)
    .where(and(eq(authMember.organizationId, orgId), eq(authMember.role, roleName)));
  if (inUse) throw conflict("People still have this role. Move them to another role first.");
  await ctx.db
    .delete(authOrganizationRole)
    .where(and(eq(authOrganizationRole.organizationId, orgId), eq(authOrganizationRole.role, roleName)));
}

export async function listRoles(ctx: AppContext, orgId: string) {
  return ctx.db
    .select({ role: authOrganizationRole.role, spec: authOrganizationRole.spec })
    .from(authOrganizationRole)
    .where(eq(authOrganizationRole.organizationId, orgId));
}
