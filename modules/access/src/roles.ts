// Custom Roles (ADR 0003): a RoleSpec the editor saves, compiled to Better Auth's permission shape and stored beside it.
import { and, eq } from "drizzle-orm";
import { authOrganizationRole, conflict, invalid, notFound, newId, type AppContext } from "@openmarko/kernel";
import { compile, presets, resources, type RoleSpec } from "@openmarko/shared";
import { z } from "zod";

const levels = ["none", "view", "edit", "publish", "manage"] as const;
const actionIds = new Set(
  Object.values(resources)
    .flat()
    .map((a) => a.id),
);

/** The spec the editor sends. Resources and groups are checked against the access model. */
export const roleSpecSchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(200).default(""),
  base: z.enum(levels),
  groups: z.record(z.string(), z.enum(levels)).default({}),
  resources: z.record(z.string(), z.union([z.enum(levels), z.array(z.string())])).default({}),
});

const presetIds = new Set(presets.map((p) => p.id));

/** Validates a spec and turns it into a RoleSpec. Unknown action ids are refused, not ignored. */
export function toRoleSpec(id: string, input: unknown): RoleSpec {
  const parsed = roleSpecSchema.safeParse(input);
  if (!parsed.success) throw invalid("That role isn't valid.", { issues: parsed.error.issues });
  for (const [r, v] of Object.entries(parsed.data.resources)) {
    if (!(r in resources)) throw invalid(`Unknown resource ${r}.`);
    if (Array.isArray(v)) {
      const unknown = v.filter((a) => !actionIds.has(a));
      if (unknown.length) throw invalid(`Unknown actions for ${r}: ${unknown.join(", ")}`);
    }
  }
  return { id, ...parsed.data } as RoleSpec;
}

export async function saveRole(ctx: AppContext, orgId: string, roleName: string, input: unknown, updating: boolean) {
  if (presetIds.has(roleName.toLowerCase())) throw conflict("That name is a built-in role.");
  const spec = toRoleSpec(roleName, input);
  const permission = JSON.stringify(compile(spec));
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
  await ctx.db
    .insert(authOrganizationRole)
    .values({ id, organizationId: orgId, role: roleName, permission, spec: spec as unknown as Record<string, unknown> });
  return id;
}

export async function deleteRole(ctx: AppContext, orgId: string, roleName: string): Promise<void> {
  const { authMember } = await import("@openmarko/kernel");
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
