// App admins: people with the admin plugin's `admin` role. They manage the app in the web app's Admin area
// (/api/v1/admin/*): users, Organizations, models, email, Plans. ADMIN_EMAILS makes the first ones; admins make the rest.
// Every look at a user is written to Activity, with the admin who did it: these are the app's customers.
import { Elysia, t } from "elysia";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { authUser, conflict, logActivity, notFound, unauthorized, forbidden, type Admin, type AppContext } from "@app/kernel";
import { authOf } from "./instance";
import { getSession } from "./session";

/** The app admin behind a request's session, or null. */
export async function adminOf(ctx: AppContext, headers: Headers): Promise<Admin | null> {
  const s = await getSession(ctx, headers);
  if (!s || s.role !== "admin") return null;
  return { userId: s.userId, email: s.email, name: s.name };
}

/** For the admin guard: the admin, or 401 / 403. */
export async function requireAdmin(ctx: AppContext, headers: Headers): Promise<Admin> {
  const s = await getSession(ctx, headers);
  if (!s) throw unauthorized();
  if (s.role !== "admin") throw forbidden("Only an app admin can do that.");
  return { userId: s.userId, email: s.email, name: s.name };
}

/**
 * Makes everyone listed in ADMIN_EMAILS an admin, for accounts that existed before they were listed. Run at boot;
 * new sign-ups get the role from the database hook (auth.ts).
 */
export async function ensureAdmins(ctx: AppContext): Promise<void> {
  if (!ctx.cfg.adminEmails.length) return;
  await ctx.pool.query(`update auth."user" set role = 'admin' where lower(email) = any($1::text[]) and coalesce(role, '') <> 'admin'`, [
    ctx.cfg.adminEmails,
  ]);
}

export type CreatedAdmin = {
  userId: string;
  /** The password to hand over, when this made the account. Null: the account existed, and its password didn't change. */
  password: string | null;
  /** The Organization made for them; null when they already belong to one, or none was asked for. */
  organizationId: string | null;
};

/**
 * Makes someone an app admin from outside the app (`bun run admin:create`): a verified account with a generated
 * password, or the role on an existing account. Doesn't go through sign-up, so it works with `auth.openSignUp` off.
 * Safe to rerun. With `organization`, they also get one to work in unless they already belong to one.
 */
export async function createAdminUser(
  ctx: AppContext,
  input: { email: string; name?: string; password?: string; organization?: { name: string; slug: string } },
): Promise<CreatedAdmin> {
  const auth = authOf(ctx);
  const email = input.email.trim().toLowerCase();
  const [existing] = await ctx.db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email));
  const password = existing ? null : (input.password ?? randomBytes(18).toString("base64url"));
  const userId =
    existing?.id ??
    (await auth.api.createUser({ body: { email, password: password!, name: input.name ?? email.split("@")[0]!, role: "admin" } })).user.id;
  await ctx.db.update(authUser).set({ role: "admin", emailVerified: true }).where(eq(authUser.id, userId));

  const { rows } = await ctx.pool.query(`select 1 from auth.member where "userId" = $1 limit 1`, [userId]);
  if (rows.length || !input.organization) return { userId, password, organizationId: null };
  const { name, slug } = input.organization;
  const taken = await ctx.pool.query(`select 1 from auth.organization where slug = $1`, [slug]);
  const org = await auth.api.createOrganization({
    body: { name, slug: taken.rows.length ? `${slug}-${randomBytes(2).toString("hex")}` : slug, timezone: "UTC", userId } as never,
  });
  return { userId, password, organizationId: (org as { id: string }).id };
}

async function record(ctx: AppContext, by: Admin, action: string, summary: string, resourceId: string | null = null) {
  await ctx.db.transaction((tx) =>
    logActivity(tx, { actorType: "admin", actorId: by.userId, action, resourceType: "user", resourceId, summary }),
  );
}

export type UserRow = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: string;
  banned: boolean;
  createdAt: Date;
  organizations: number;
  sessions: number;
};

export function adminUserRoutes(ctx: AppContext) {
  const guard = ctx.adminGuard!;
  return new Elysia({ name: "identity.admin-users" }).group("/api/v1/admin/users", (g) =>
    g
      .use(guard)
      .get(
        "/",
        async ({ admin, query }) => {
          const q = (query.q ?? "").trim();
          const { rows } = await ctx.pool.query(
            `select u.id, u.email, u.name, u."emailVerified", coalesce(u.role, 'user') as role, coalesce(u.banned, false) as banned, u."createdAt",
                    (select count(*)::int from auth.member m where m."userId" = u.id) as organizations,
                    (select count(*)::int from auth.session s where s."userId" = u.id and s."expiresAt" > now()) as sessions
               from auth."user" u
              ${q ? `where (u.email ilike $1 or u.name ilike $1)` : ""}
              order by u."createdAt" desc limit 200`,
            q ? [`%${q.replace(/[%_]/g, "")}%`] : [],
          );
          await record(ctx, admin, "users.list", q ? `Looked up users matching "${q.slice(0, 60)}"` : "Looked at the list of users");
          return rows as UserRow[];
        },
        { query: t.Object({ q: t.Optional(t.String({ maxLength: 120 })) }), detail: { summary: "The app's users (recorded in Activity)" } },
      )
      .get(
        "/:userId",
        async ({ admin, params }) => {
          const { rows } = await ctx.pool.query(
            `select id, email, name, "emailVerified", coalesce(role, 'user') as role, coalesce(banned, false) as banned, "createdAt" from auth."user" where id = $1`,
            [params.userId],
          );
          if (!rows[0]) throw notFound("User");
          const { rows: orgs } = await ctx.pool.query(
            `select o.id, o.name, m.role from auth.member m join auth.organization o on o.id = m."organizationId" where m."userId" = $1 order by o.name`,
            [params.userId],
          );
          await record(ctx, admin, "users.view", `Looked at ${rows[0].email}`, params.userId);
          return {
            ...(rows[0] as Omit<UserRow, "organizations" | "sessions">),
            organizations: orgs as { id: string; name: string; role: string }[],
          };
        },
        { detail: { summary: "One user: their Organizations and Roles (recorded in Activity)" } },
      )
      .post(
        "/:userId/sign-out",
        async ({ admin, params }) => {
          const [u] = await ctx.db.select({ email: authUser.email }).from(authUser).where(eq(authUser.id, params.userId));
          if (!u) throw notFound("User");
          const res = await ctx.pool.query(`delete from auth.session where "userId" = $1`, [params.userId]);
          await record(ctx, admin, "users.sign_out", `Signed ${u.email} out everywhere`, params.userId);
          return { sessionsEnded: res.rowCount ?? 0 };
        },
        { detail: { summary: "Sign a user out everywhere (their sessions end at once)" } },
      )
      .patch(
        "/:userId",
        async ({ admin, params, body }) => {
          const [u] = await ctx.db
            .select({ email: authUser.email, role: authUser.role })
            .from(authUser)
            .where(eq(authUser.id, params.userId));
          if (!u) throw notFound("User");
          if (body.role === "user" && params.userId === admin.userId) throw conflict("You can't take away your own admin role.");
          if (body.role !== undefined) {
            if (body.role === "user" && u.role === "admin") {
              const [{ n }] = (await ctx.db
                .select({ n: sql<number>`count(*)::int` })
                .from(authUser)
                .where(eq(authUser.role, "admin"))) as [{ n: number }];
              if (n <= 1) throw conflict("This is the last admin. Make someone else an admin first.");
            }
            await ctx.db.update(authUser).set({ role: body.role }).where(eq(authUser.id, params.userId));
            await record(ctx, admin, "users.role", `${u.email} is now ${body.role}`, params.userId);
          }
          if (body.banned !== undefined) {
            await ctx.db.update(authUser).set({ banned: body.banned }).where(eq(authUser.id, params.userId));
            if (body.banned) await ctx.pool.query(`delete from auth.session where "userId" = $1`, [params.userId]);
            await record(
              ctx,
              admin,
              body.banned ? "users.ban" : "users.unban",
              `${u.email} ${body.banned ? "banned" : "unbanned"}`,
              params.userId,
            );
          }
          return { ok: true };
        },
        {
          body: t.Object({ role: t.Optional(t.Union([t.Literal("admin"), t.Literal("user")])), banned: t.Optional(t.Boolean()) }),
          detail: { summary: "Make a user an app admin (or not), or ban and unban them" },
        },
      ),
  );
}
