import { and, eq, sql } from "drizzle-orm";
import {
  authInvitation,
  authMember,
  authOrganization,
  authUser,
  conflict,
  emit,
  forbidden,
  invalid,
  logActivity,
  newId,
  notFound,
  authOrganizationRole,
  type ActivityInput,
  type AppContext,
} from "@app/kernel";
import { presets } from "@app/shared";
import { runDeleteHooks } from "./hooks";

type Actor = { userId: string; orgId: string };

/** An Activity row for something a member did in their Organization (the common case in this module). */
const memberActivity = (
  actor: Actor,
  fields: Omit<ActivityInput, "organizationId" | "actorType" | "actorId">,
  organizationId = actor.orgId,
): ActivityInput => ({
  organizationId,
  actorType: "member",
  actorId: actor.userId,
  ...fields,
});

/** The Organization row, with the fields this module reads. */
export async function getOrganization(ctx: AppContext, orgId: string) {
  const [org] = await ctx.db.select().from(authOrganization).where(eq(authOrganization.id, orgId));
  if (!org) throw notFound("Organization");
  return org;
}

export async function updateOrganization(ctx: AppContext, actor: Actor, input: { name?: string; timezone?: string }) {
  await ctx.db.transaction(async (tx) => {
    const org = await getOrganization(ctx, actor.orgId);
    await tx.update(authOrganization).set(input).where(eq(authOrganization.id, actor.orgId));
    await logActivity(
      tx,
      memberActivity(actor, {
        action: "organization.update",
        resourceType: "organization",
        resourceId: org.id,
        summary: "Organization settings changed",
        data: input,
      }),
    );
  });
}

/**
 * Gives a user a role in an Organization. Invitations and Partner staff use this too, so the row is always
 * written the same way (Better Auth requires createdAt).
 */
export async function addMember(ctx: AppContext, orgId: string, userId: string, role: string): Promise<void> {
  const [existing] = await ctx.db
    .select({ id: authMember.id })
    .from(authMember)
    .where(and(eq(authMember.organizationId, orgId), eq(authMember.userId, userId)));
  if (existing) {
    await ctx.db.update(authMember).set({ role }).where(eq(authMember.id, existing.id));
    return;
  }
  const [user] = await ctx.db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, userId));
  if (!user) throw notFound("User");
  await ctx.db.insert(authMember).values({ id: newId(), organizationId: orgId, userId, role, createdAt: new Date() });
}

// ---------- People (ADR 0003, ADR 0011) ----------

const OWNER = "owner";
const presetIds = new Set(presets.map((p) => p.id));

type RoleActor = Actor & { role: string };

/** A role a member can be given here: a built-in one, or one of this Organization's custom Roles. */
async function roleExists(ctx: AppContext, orgId: string, role: string): Promise<boolean> {
  if (presetIds.has(role)) return true;
  const [custom] = await ctx.db
    .select({ id: authOrganizationRole.id })
    .from(authOrganizationRole)
    .where(and(eq(authOrganizationRole.organizationId, orgId), eq(authOrganizationRole.role, role)));
  return !!custom;
}

async function memberRole(ctx: AppContext, orgId: string, userId: string): Promise<string> {
  const [m] = await ctx.db
    .select({ role: authMember.role })
    .from(authMember)
    .where(and(eq(authMember.organizationId, orgId), eq(authMember.userId, userId)));
  if (!m) throw notFound("Member");
  return m.role;
}

async function ownerCount(ctx: AppContext, orgId: string): Promise<number> {
  const [row] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(authMember)
    .where(and(eq(authMember.organizationId, orgId), eq(authMember.role, OWNER)));
  return row?.n ?? 0;
}

/**
 * Ownership rules, shared by role changes and removals: only an Owner touches ownership, and an Organization
 * always keeps at least one Owner.
 */
async function guardOwnership(ctx: AppContext, actor: RoleActor, targetRole: string, losesOwnership: boolean, grantsOwnership: boolean) {
  if ((targetRole === OWNER || grantsOwnership) && actor.role !== OWNER) {
    throw forbidden("Only an owner can give or take away ownership.");
  }
  if (targetRole === OWNER && losesOwnership && (await ownerCount(ctx, actor.orgId)) <= 1) {
    throw conflict("An organization needs at least one owner. Make someone else an owner first.");
  }
}

export async function changeMemberRole(ctx: AppContext, actor: RoleActor, userId: string, role: string): Promise<void> {
  if (!(await roleExists(ctx, actor.orgId, role))) throw invalid(`There's no role called "${role}" here.`);
  const current = await memberRole(ctx, actor.orgId, userId);
  if (current === role) return;
  await guardOwnership(ctx, actor, current, role !== OWNER, role === OWNER);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(authMember)
      .set({ role })
      .where(and(eq(authMember.organizationId, actor.orgId), eq(authMember.userId, userId)));
    await logActivity(
      tx,
      memberActivity(actor, {
        action: "member.update",
        resourceType: "member",
        summary: `Role changed from ${current} to ${role}`,
        data: { userId },
      }),
    );
  });
}

export async function removeMember(ctx: AppContext, actor: RoleActor, userId: string): Promise<void> {
  const current = await memberRole(ctx, actor.orgId, userId);
  await guardOwnership(ctx, actor, current, true, false);
  await ctx.db.transaction(async (tx) => {
    await tx.delete(authMember).where(and(eq(authMember.organizationId, actor.orgId), eq(authMember.userId, userId)));
    await logActivity(
      tx,
      memberActivity(actor, {
        action: "member.delete",
        resourceType: "member",
        summary: `Removed a member (${current})`,
        data: { userId },
      }),
    );
  });
}

/** Members with who they are: the Team page. */
export async function listMembers(ctx: AppContext, orgId: string) {
  return ctx.db
    .select({ userId: authMember.userId, role: authMember.role, email: authUser.email, name: authUser.name, since: authMember.createdAt })
    .from(authMember)
    .innerJoin(authUser, eq(authUser.id, authMember.userId))
    .where(eq(authMember.organizationId, orgId))
    .orderBy(authMember.createdAt);
}

/** Invitations still waiting: listed with the Team page's People. */
export async function listPendingInvitations(ctx: AppContext, orgId: string) {
  return ctx.db
    .select({ id: authInvitation.id, email: authInvitation.email, role: authInvitation.role, expiresAt: authInvitation.expiresAt })
    .from(authInvitation)
    .where(and(eq(authInvitation.organizationId, orgId), eq(authInvitation.status, "pending"), sql`${authInvitation.expiresAt} > now()`))
    .orderBy(authInvitation.expiresAt);
}

// ---------- Archive and delete (schema.md) ----------

export async function archiveOrganization(ctx: AppContext, actor: Actor, archived: boolean): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(authOrganization)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(authOrganization.id, actor.orgId));
    await logActivity(
      tx,
      memberActivity(actor, {
        action: "organization.update",
        resourceType: "organization",
        resourceId: actor.orgId,
        summary: archived ? "Organization archived" : "Organization unarchived",
      }),
    );
    await emit(tx, { event: archived ? "organization.archived" : "organization.unarchived", organizationId: actor.orgId, payload: {} });
  });
}

/**
 * Hard delete: Owner only, and only after archiving (a safety step). Cleanup hooks run first, then the
 * Organization row is removed. Every tenant table cascades from it (schema.md).
 */
export async function hardDeleteOrganization(ctx: AppContext, actor: Actor): Promise<void> {
  const org = await getOrganization(ctx, actor.orgId);
  if (!org.archivedAt) throw conflict("Archive the organization before deleting it.");
  await runDeleteHooks(ctx, actor.orgId);
  await ctx.db.transaction(async (tx) => {
    await tx.delete(authOrganization).where(eq(authOrganization.id, actor.orgId));
    await emit(tx, { event: "organization.deleted", organizationId: null, payload: { organizationId: actor.orgId } });
  });
}
