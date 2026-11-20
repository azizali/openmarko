// The Admin area's view of Organizations: list them with their Owner's status, and create one with its first Owner.
// The Owner is either already a user (added straight away) or is invited by email. An invitation needs an inviting
// user (Better Auth's rule), so the admin who creates the Organization is the inviter.
import { eq } from "drizzle-orm";
import { authOrganization, conflict, invalid, logActivity, type Admin, type AppContext } from "@app/kernel";
import { authOf, type Auth } from "@app/identity";
import { addMember } from "./service";

const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** Better Auth's default: an invitation lasts two days. */
const INVITATION_MS = 48 * 60 * 60 * 1000;

export type OwnerStatus = { email: string | null; status: "joined" | "invited" | "none" };
export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  partnerId: string | null;
  createdAt: Date;
  archivedAt: Date | null;
  members: number;
  owner: OwnerStatus;
};

/** Every Organization, newest first, each with its Owner: joined, invited (not yet accepted), or none. */
export async function listOrganizations(ctx: AppContext): Promise<OrganizationRow[]> {
  const { rows } = await ctx.pool.query(
    `select o.id, o.name, o.slug, o."partnerId", o."createdAt", o."archivedAt",
            (select count(*)::int from auth.member m where m."organizationId" = o.id) as members,
            (select u.email from auth.member m join auth."user" u on u.id = m."userId"
              where m."organizationId" = o.id and m.role = 'owner' order by m."createdAt" limit 1) as "ownerEmail",
            (select i.email from auth.invitation i
              where i."organizationId" = o.id and i.role = 'owner' and i.status = 'pending' and i."expiresAt" > now()
              order by i."createdAt" desc limit 1) as "invitedEmail"
       from auth.organization o order by o."createdAt" desc limit 500`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    partnerId: r.partnerId,
    createdAt: r.createdAt,
    archivedAt: r.archivedAt,
    members: r.members,
    owner: r.ownerEmail
      ? { email: r.ownerEmail, status: "joined" }
      : r.invitedEmail
        ? { email: r.invitedEmail, status: "invited" }
        : { email: null, status: "none" },
  }));
}

export type CreatedOrganization = {
  id: string;
  name: string;
  slug: string;
  owner: { email: string; status: "joined" | "invited" };
  /** For an invitation: whether the email went out. When it didn't, the Owner needs the link another way. */
  emailed: boolean | null;
};

/**
 * Creates an Organization with its first Owner. An existing user becomes Owner at once; anyone else gets an
 * invitation by email, pending until they accept it.
 */
export async function createOrganization(
  ctx: AppContext,
  input: { name: string; slug: string; ownerEmail: string; by: Admin },
): Promise<CreatedOrganization> {
  if (input.slug.length < 2 || input.slug.length > 40 || !SLUG.test(input.slug)) {
    throw invalid("A slug is 2–40 lowercase letters, digits or dashes, starting with a letter.");
  }
  const name = input.name.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const [taken] = await ctx.db.select({ id: authOrganization.id }).from(authOrganization).where(eq(authOrganization.slug, input.slug));
  if (taken) throw conflict(`An Organization with the slug "${input.slug}" already exists.`);

  const c: Awaited<Auth["$context"]> = await authOf(ctx).$context;
  const org = (await c.adapter.create({
    model: "organization",
    data: { name, slug: input.slug, timezone: "UTC", createdAt: new Date() },
  })) as { id: string };

  const existing = (await c.internalAdapter.findUserByEmail(ownerEmail))?.user ?? null;
  let owner: CreatedOrganization["owner"];
  let emailed: boolean | null = null;
  if (existing) {
    await addMember(ctx, org.id, existing.id, "owner");
    owner = { email: ownerEmail, status: "joined" };
  } else {
    const invitation = (await c.adapter.create({
      model: "invitation",
      data: {
        organizationId: org.id,
        email: ownerEmail,
        role: "owner",
        status: "pending",
        inviterId: input.by.userId,
        expiresAt: new Date(Date.now() + INVITATION_MS),
        createdAt: new Date(),
      },
    })) as { id: string };
    emailed =
      (await ctx.email?.({
        organizationId: org.id,
        to: ownerEmail,
        template: "invitation",
        data: { invitationId: invitation.id, organization: name, inviter: input.by.name, role: "owner" },
      })) ?? false;
    owner = { email: ownerEmail, status: "invited" };
  }

  await ctx.db.transaction((tx) =>
    logActivity(tx, {
      organizationId: org.id,
      actorType: "admin",
      actorId: input.by.userId,
      action: "organization.create",
      resourceType: "organization",
      resourceId: org.id,
      summary: `Created ${name}; ${ownerEmail} ${owner.status === "joined" ? "added as Owner" : "invited as Owner"}`,
    }),
  );
  return { id: org.id, name, slug: input.slug, owner, emailed };
}
