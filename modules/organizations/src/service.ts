import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  authMember,
  authOrganization,
  conflict,
  emit,
  forbidden,
  invalid,
  logActivity,
  newId,
  notFound,
  planLimit,
  authOrganizationRole,
  type ActivityInput,
  type AppContext,
  type Tx,
} from "@openmarko/kernel";
import { presets } from "@openmarko/shared";
import { checkLimit, entitlementsFor } from "@openmarko/billing";
import { locations, websites, partnerRequests, domains } from "./schema";
import { normalizeDomain } from "./domain";
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

export async function updateOrganization(
  ctx: AppContext,
  actor: Actor,
  input: { name?: string; category?: string | null; timezone?: string },
) {
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

// ---------- Locations ----------

export type LocationInput = {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  timezone?: string | null;
  placeId?: string | null;
  websiteUrl?: string | null;
};

export async function createLocation(ctx: AppContext, actor: Actor, input: LocationInput): Promise<string> {
  const ent = await entitlementsFor(ctx, actor.orgId);
  const [row] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(locations)
    .where(and(eq(locations.organizationId, actor.orgId), isNull(locations.archivedAt)));
  checkLimit(ent, "locations", row?.n ?? 0);
  const id = newId();
  await ctx.db.transaction(async (tx) => {
    await tx.insert(locations).values({ id, organizationId: actor.orgId, ...input, country: input.country ?? "US" });
    await logActivity(
      tx,
      memberActivity(actor, {
        action: "setup.connect",
        resourceType: "location",
        resourceId: id,
        locationId: id,
        summary: `Location added: ${input.name}`,
      }),
    );
    await emit(tx, { event: "location.created", organizationId: actor.orgId, payload: { locationId: id } });
  });
  return id;
}

export async function updateLocation(ctx: AppContext, actor: Actor, locationId: string, input: Partial<LocationInput>) {
  const [loc] = await ctx.db
    .select()
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.organizationId, actor.orgId)));
  if (!loc) throw notFound("Location");
  await ctx.db
    .update(locations)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(locations.id, locationId));
}

/** Archiving a Location stops its jobs and hides it. Its history stays. The Google Business Profile is released. */
export async function archiveLocation(ctx: AppContext, actor: Actor, locationId: string): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const [loc] = await tx
      .select()
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.organizationId, actor.orgId)));
    if (!loc) throw notFound("Location");
    await tx
      .update(locations)
      .set({ archivedAt: new Date(), gbpId: null, gbpConnectionId: null, updatedAt: new Date() })
      .where(eq(locations.id, locationId));
    await logActivity(
      tx,
      memberActivity(actor, {
        action: "setup.connect",
        resourceType: "location",
        resourceId: locationId,
        locationId,
        summary: `Location archived: ${loc.name}`,
      }),
    );
    await emit(tx, { event: "location.archived", organizationId: actor.orgId, payload: { locationId, gbpId: loc.gbpId } });
  });
}

/** Records which Google Business Profile a Location is connected to. Called by the seo module after it connects. */
export async function setLocationGbp(tx: Tx, orgId: string, locationId: string, gbpId: string, connectionId: string): Promise<void> {
  const [clash] = await tx.select({ id: locations.id }).from(locations).where(eq(locations.gbpId, gbpId));
  if (clash && clash.id !== locationId) throw conflict("That Google Business Profile is already connected to another Location.");
  await tx
    .update(locations)
    .set({ gbpId, gbpConnectionId: connectionId, updatedAt: new Date() })
    .where(and(eq(locations.id, locationId), eq(locations.organizationId, orgId)));
}

export async function listLocations(ctx: AppContext, orgId: string) {
  return ctx.db
    .select()
    .from(locations)
    .where(and(eq(locations.organizationId, orgId), isNull(locations.archivedAt)));
}

// ---------- Websites ----------

export async function addWebsite(ctx: AppContext, actor: Actor, rawDomain: string): Promise<string> {
  const domain = normalizeDomain(rawDomain);
  const [existing] = await ctx.db
    .select()
    .from(websites)
    .where(and(eq(websites.organizationId, actor.orgId), eq(websites.domain, domain)));
  if (existing) {
    if (!existing.archived) throw conflict("This website is already added.");
    await ctx.db.update(websites).set({ archived: false, updatedAt: new Date() }).where(eq(websites.id, existing.id));
    return existing.id;
  }
  const id = newId();
  await ctx.db.transaction(async (tx) => {
    await tx.insert(websites).values({ id, organizationId: actor.orgId, domain });
    await logActivity(
      tx,
      memberActivity(actor, { action: "setup.connect", resourceType: "website", resourceId: id, summary: `Website added: ${domain}` }),
    );
    await emit(tx, { event: "website.added", organizationId: actor.orgId, payload: { websiteId: id, domain } });
  });
  return id;
}

export async function listWebsites(ctx: AppContext, orgId: string) {
  return ctx.db
    .select()
    .from(websites)
    .where(and(eq(websites.organizationId, orgId), eq(websites.archived, false)));
}

export async function archiveWebsite(ctx: AppContext, actor: Actor, websiteId: string): Promise<void> {
  const res = await ctx.db
    .update(websites)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(websites.id, websiteId), eq(websites.organizationId, actor.orgId)))
    .returning({ id: websites.id });
  if (res.length === 0) throw notFound("Website");
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

export async function listMembers(ctx: AppContext, orgId: string) {
  return ctx.db.select({ userId: authMember.userId, role: authMember.role }).from(authMember).where(eq(authMember.organizationId, orgId));
}

// ---------- Partners and Clients (ADR 0011) ----------

async function isPartnerPlan(ctx: AppContext, orgId: string): Promise<boolean> {
  const ent = await entitlementsFor(ctx, orgId);
  return ent.get("partner") === 1;
}

/**
 * A Partner asks to take a Client on. The caller acts for the Partner (its Plan must include `partner`).
 * Nothing changes until the Client's owner accepts (respondToPartnerRequest).
 */
export async function requestClient(ctx: AppContext, actor: Actor, clientId: string): Promise<string> {
  if (!(await isPartnerPlan(ctx, actor.orgId))) throw planLimit("partner");
  const client = await getOrganization(ctx, clientId);
  if (client.partnerId) throw conflict("This organization already has a Partner.");
  if (client.id === actor.orgId) throw invalid("An organization can't be its own Client.");
  const [pending] = await ctx.db
    .select({ id: partnerRequests.id })
    .from(partnerRequests)
    .where(and(eq(partnerRequests.partnerId, actor.orgId), eq(partnerRequests.clientId, clientId), eq(partnerRequests.status, "pending")));
  if (pending) throw conflict("A request for this client is already waiting.");
  const id = newId();
  await ctx.db.transaction(async (tx) => {
    await tx.insert(partnerRequests).values({ id, partnerId: actor.orgId, clientId, status: "pending", requestedBy: actor.userId });
    await emit(tx, { event: "partner.requested", organizationId: clientId, payload: { requestId: id, partnerId: actor.orgId } });
  });
  return id;
}

/** The Client's owner accepts (attaches the Partner) or declines. */
export async function respondToPartnerRequest(ctx: AppContext, actor: Actor, requestId: string, accept: boolean): Promise<void> {
  const [req] = await ctx.db
    .select()
    .from(partnerRequests)
    .where(and(eq(partnerRequests.id, requestId), eq(partnerRequests.clientId, actor.orgId)));
  if (!req) throw notFound("Request");
  if (req.status !== "pending") throw conflict(`This request is already ${req.status}.`);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(partnerRequests)
      .set({ status: accept ? "accepted" : "declined", decidedAt: new Date() })
      .where(eq(partnerRequests.id, requestId));
    if (accept) {
      await tx.update(authOrganization).set({ partnerId: req.partnerId }).where(eq(authOrganization.id, actor.orgId));
    }
    await logActivity(
      tx,
      memberActivity(actor, {
        action: "organization.update",
        resourceType: "organization",
        resourceId: actor.orgId,
        summary: accept ? "Accepted a Partner" : "Declined a Partner",
        data: { partnerId: req.partnerId },
      }),
    );
    await emit(tx, {
      event: accept ? "partner.client_added" : "partner.declined",
      organizationId: actor.orgId,
      payload: { partnerId: req.partnerId, requestId },
    });
  });
}

export async function listPartnerRequests(ctx: AppContext, orgId: string, side: "partner" | "client") {
  return ctx.db
    .select()
    .from(partnerRequests)
    .where(side === "partner" ? eq(partnerRequests.partnerId, orgId) : eq(partnerRequests.clientId, orgId))
    .orderBy(sql`created_at desc`);
}

// ---------- Whitelabel domains (ADR 0004) ----------

/** A Partner adds a host (its own domain or a subdomain) that shows its brand. */
export async function addDomain(ctx: AppContext, actor: Actor, rawHost: string): Promise<void> {
  if (!(await isPartnerPlan(ctx, actor.orgId))) throw planLimit("partner");
  const host = normalizeHost(rawHost);
  const [owner] = await ctx.db.select({ partnerId: domains.partnerId }).from(domains).where(eq(domains.host, host));
  if (owner && owner.partnerId !== actor.orgId) throw conflict("That host belongs to another Partner.");
  await ctx.db.insert(domains).values({ host, partnerId: actor.orgId }).onConflictDoNothing();
}

export function normalizeHost(raw: string): string {
  const host = raw.trim().toLowerCase().replace(/:\d+$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) throw invalid("That doesn't look like a host name.", { host: raw });
  return host;
}

/** The Partner whose brand a host shows, or null for the product's own brand. */
export async function partnerForHost(ctx: AppContext, rawHost: string | null): Promise<string | null> {
  if (!rawHost) return null;
  let host: string;
  try {
    host = normalizeHost(rawHost);
  } catch {
    return null;
  }
  const [row] = await ctx.db.select({ partnerId: domains.partnerId }).from(domains).where(eq(domains.host, host));
  return row?.partnerId ?? null;
}

/** Members who belong to both the Client and its Partner: the people transfer-out asks about. */
export async function agencyMembersOf(ctx: AppContext, clientId: string) {
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
  const members = await agencyMembersOf(ctx, clientId);
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
  const agency = new Set((await agencyMembersOf(ctx, clientId)).map((m) => m.userId));
  const unknown = revokeUserIds.filter((u) => !agency.has(u));
  if (unknown.length) throw invalid("Those people aren't agency members of this organization.", { unknown });
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
