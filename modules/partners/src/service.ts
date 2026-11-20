// Partners and their Clients (ADR 0011, ADR 0023): a Partner creates its Clients, shows them its own
// brand, and a Client can leave with a say over which Partner people keep access. Optional: without this module, none of this exists and Organizations have no Partners.
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  authMember,
  authOrganization,
  billingOf,
  conflict,
  emit,
  invalid,
  logActivity,
  planLimit,
  type ActivityInput,
  type AppContext,
} from "@app/kernel";
import { authOf } from "@app/identity";
import { getOrganization } from "@app/organizations";

type Actor = { userId: string; orgId: string };

/** An Activity row for something a member did in their Organization. */
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

/** Whether the Organization may act as a Partner: its Plan says `partner = 1`. Without billing, anyone may. */
export async function isPartnerPlan(ctx: AppContext, orgId: string): Promise<boolean> {
  // A Client runs on its Partner's Plan, `partner` included. That doesn't make it a Partner: one level only (ADR 0011).
  if ((await getOrganization(ctx, orgId)).partnerId) return false;
  const billing = billingOf(ctx);
  if (!billing.enabled) return true;
  return (await billing.entitlementsFor(orgId)).get("partner") === 1;
}

/**
 * A Partner creates an Organization as its Client (ADR 0023). The caller acts for the Partner (its Plan must include
 * `partner`) and becomes the new Organization's first Owner; the headers carry their session to Better Auth.
 */
export async function createClient(
  ctx: AppContext,
  actor: Actor,
  headers: Headers,
  input: { name: string; slug: string; timezone: string },
): Promise<{ id: string }> {
  if (!(await isPartnerPlan(ctx, actor.orgId))) throw planLimit("partner");
  const [taken] = await ctx.db.select({ id: authOrganization.id }).from(authOrganization).where(eq(authOrganization.slug, input.slug));
  if (taken) throw conflict("That short name is already in use.");
  const org = await authOf(ctx).api.createOrganization({ body: input as never, headers });
  const id = org!.id;
  await ctx.db.transaction(async (tx) => {
    await tx.update(authOrganization).set({ partnerId: actor.orgId }).where(eq(authOrganization.id, id));
    await logActivity(
      tx,
      memberActivity(actor, {
        action: "organization.create",
        resourceType: "organization",
        resourceId: id,
        summary: `Created the client ${input.name}`,
      }),
    );
    await emit(tx, { event: "partner.client_added", organizationId: id, payload: { partnerId: actor.orgId } });
  });
  return { id };
}

/** The Partners this person works at, whichever Organization they have open. */
export async function partnersOf(ctx: AppContext, userId: string): Promise<{ id: string; name: string }[]> {
  const orgs = await ctx.db
    .select({ id: authOrganization.id, name: authOrganization.name })
    .from(authMember)
    .innerJoin(authOrganization, eq(authOrganization.id, authMember.organizationId))
    .where(and(eq(authMember.userId, userId), isNull(authOrganization.archivedAt), isNull(authOrganization.partnerId)))
    .orderBy(authOrganization.name);
  const partner = await Promise.all(orgs.map((o) => isPartnerPlan(ctx, o.id)));
  return orgs.filter((_, i) => partner[i]);
}

/** A Partner's Clients: the Organizations that point at it. */
export async function listClients(ctx: AppContext, partnerId: string) {
  return ctx.db
    .select({
      id: authOrganization.id,
      name: authOrganization.name,
      slug: authOrganization.slug,
      archivedAt: authOrganization.archivedAt,
      members: sql<number>`(select count(*)::int from auth.member m where m."organizationId" = auth.organization.id)`,
    })
    .from(authOrganization)
    .where(eq(authOrganization.partnerId, partnerId))
    .orderBy(authOrganization.name);
}

/** Members who belong to both the Client and its Partner: the people transfer-out asks about. */
export async function partnerMembersOf(ctx: AppContext, clientId: string) {
  const client = await getOrganization(ctx, clientId);
  if (!client.partnerId) return [];
  return ctx.db
    .select({ userId: authMember.userId, clientRole: authMember.role })
    .from(authMember)
    .where(
      and(
        eq(authMember.organizationId, clientId),
        inArray(
          authMember.userId,
          ctx.db.select({ u: authMember.userId }).from(authMember).where(eq(authMember.organizationId, client.partnerId)),
        ),
      ),
    );
}

export type TransferOutPreview = {
  partnerId: string | null;
  members: { userId: string; role: string }[];
  /** What happens when the transfer goes ahead. */
  effects: string[];
};

export async function transferOutPreview(ctx: AppContext, clientId: string): Promise<TransferOutPreview> {
  const client = await getOrganization(ctx, clientId);
  const members = await partnerMembersOf(ctx, clientId);
  return {
    partnerId: client.partnerId,
    members: members.map((m) => ({ userId: m.userId, role: m.clientRole })),
    effects: client.partnerId
      ? [
          "The Partner's brand stops showing for this organization.",
          "The Partner's plan stops covering it. It needs its own plan.",
          "Each person you choose to revoke loses access right away. Everyone else keeps their access.",
        ]
      : [],
  };
}

/** Confirms the transfer. Only the Owner may do it (route checks). `revokeUserIds` must come from the preview. */
export async function transferOut(ctx: AppContext, actor: Actor, clientId: string, revokeUserIds: string[]): Promise<void> {
  const client = await getOrganization(ctx, clientId);
  if (!client.partnerId) throw conflict("This organization isn't connected to a Partner.");
  const partnerPeople = new Set((await partnerMembersOf(ctx, clientId)).map((m) => m.userId));
  const unknown = revokeUserIds.filter((u) => !partnerPeople.has(u));
  if (unknown.length) throw invalid("Those people aren't Partner members of this organization.", { unknown });
  await ctx.db.transaction(async (tx) => {
    if (revokeUserIds.length) {
      await tx.delete(authMember).where(and(eq(authMember.organizationId, clientId), inArray(authMember.userId, revokeUserIds)));
    }
    await tx.update(authOrganization).set({ partnerId: null }).where(eq(authOrganization.id, clientId));
    for (const userId of revokeUserIds) {
      await logActivity(
        tx,
        memberActivity(
          actor,
          { action: "member.delete", resourceType: "member", resourceId: userId, summary: "Access revoked on transfer out" },
          clientId,
        ),
      );
    }
    await logActivity(
      tx,
      memberActivity(
        actor,
        {
          action: "organization.update",
          resourceType: "organization",
          resourceId: clientId,
          summary: "Transferred out of its Partner",
          data: { previousPartnerId: client.partnerId, revoked: revokeUserIds.length },
        },
        clientId,
      ),
    );
    await emit(tx, {
      event: "partner.client_removed",
      organizationId: clientId,
      payload: { previousPartnerId: client.partnerId, revokeUserIds },
    });
  });
}
