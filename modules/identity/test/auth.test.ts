// Sign-in is Better Auth's, one instance for the app: sign-up, sessions, Organizations, and the admin role from
// ADMIN_EMAILS. The origin check is on, as in production.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { adminSession, createTestDb, ownerSession, requester, userSession, type TestDb } from "@app/testkit";
import { compose, buildApi } from "@app/server";
import { authMethods, authOf, ensureAdmins, getSession, migrateAuth } from "../src";

let t: TestDb;
let call: ReturnType<typeof requester>;

beforeAll(async () => {
  t = await createTestDb();
  call = requester(buildApi(t.ctx, compose(t.ctx)));
});
afterAll(() => t.teardown());

describe("auth tables", () => {
  test("Better Auth's tables live in the auth schema, email unique", async () => {
    const { rows } = await t.ctx.pool.query(`select tablename from pg_tables where schemaname = 'auth' order by 1`);
    expect(rows.map((r) => r.tablename)).toEqual(
      expect.arrayContaining(["user", "session", "organization", "member", "invitation", "organizationRole"]),
    );
    const { rows: idx } = await t.ctx.pool.query(`select indexdef from pg_indexes where schemaname = 'auth' and tablename = 'user'`);
    expect(idx.map((r) => r.indexdef).join("\n")).toMatch(/\(email\)/);
  });

  test("migrating again changes nothing", async () => {
    const before = await t.ctx.pool.query(`select count(*)::int as n from pg_indexes where schemaname = 'auth'`);
    await migrateAuth(t.cfg);
    const after = await t.ctx.pool.query(`select count(*)::int as n from pg_indexes where schemaname = 'auth'`);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});

describe("sign-in", () => {
  test("methods: email and password always; Google only with its keys", () => {
    expect(authMethods(t.cfg)).toMatchObject({ emailAndPassword: true, google: false });
    expect(authMethods({ google: { clientId: "a", clientSecret: "b" } }).google).toBe(true);
  });

  test("a person signs up, signs in, and their session says who they are", async () => {
    const u = await userSession(t.ctx, { name: "Sam" });
    const s = await getSession(t.ctx, u.headers);
    expect(s).toMatchObject({ userId: u.userId, email: u.email, name: "Sam", role: "user", activeOrganizationId: null });
    expect(await getSession(t.ctx, new Headers())).toBeNull();
  });

  test("the same email can't sign up twice", async () => {
    const u = await userSession(t.ctx);
    await expect(authOf(t.ctx).api.signUpEmail({ body: { email: u.email, password: "password-123", name: "Again" } })).rejects.toThrow();
  });

  test("a browser's request from an origin the app doesn't trust is refused (CSRF)", async () => {
    const r = await call("POST", "/api/auth/sign-up/email", {
      headers: new Headers({ origin: "https://evil.test", cookie: "theme=dark" }),
      body: { email: "evil@app.test", password: "password-123", name: "Evil" },
    });
    expect(r.status).toBe(403);
    const ok = await call("POST", "/api/auth/sign-up/email", {
      headers: new Headers({ origin: t.cfg.appUrl, cookie: "theme=dark" }),
      body: { email: "fine@app.test", password: "password-123", name: "Fine" },
    });
    expect(ok.status).toBe(200);
  });

  test("an Organization's creator is its Owner, and its active Organization is set", async () => {
    const o = await ownerSession(t.ctx, { orgName: "Owned" });
    const { rows } = await t.ctx.pool.query(`select role from auth.member where "organizationId" = $1 and "userId" = $2`, [
      o.orgId,
      o.userId,
    ]);
    expect(rows[0].role).toBe("owner");
    expect((await getSession(t.ctx, o.headers))?.activeOrganizationId).toBe(o.orgId);
  });
});

describe("app admins", () => {
  test("ADMIN_EMAILS makes an admin at sign-up; everyone else is a user", async () => {
    const admin = await adminSession(t.ctx);
    expect((await getSession(t.ctx, admin.headers))?.role).toBe("admin");
    const u = await userSession(t.ctx);
    expect((await getSession(t.ctx, u.headers))?.role).toBe("user");
  });

  test("ensureAdmins promotes an existing account that's listed", async () => {
    const u = await userSession(t.ctx, { email: "later@app.test" });
    t.ctx.cfg.adminEmails.push("later@app.test");
    await ensureAdmins(t.ctx);
    expect((await getSession(t.ctx, u.headers))?.role).toBe("admin");
  });

  test("an admin changes roles and bans; the last admin can't demote themselves", async () => {
    const admin = await adminSession(t.ctx);
    const u = await userSession(t.ctx);
    expect((await call("PATCH", `/api/v1/admin/users/${u.userId}`, { headers: admin.headers, body: { role: "admin" } })).status).toBe(200);
    expect((await call("PATCH", `/api/v1/admin/users/${admin.userId}`, { headers: admin.headers, body: { role: "user" } })).status).toBe(
      409,
    );
    expect(
      (await call("PATCH", `/api/v1/admin/users/${u.userId}`, { headers: admin.headers, body: { role: "user", banned: true } })).status,
    ).toBe(200);
    // Banned: signed out everywhere, and no session answers.
    expect(await getSession(t.ctx, u.headers)).toBeNull();
    expect((await call("GET", `/api/v1/admin/users/${u.userId}`, { headers: admin.headers })).body).toMatchObject({
      banned: true,
      role: "user",
    });
  });
});
