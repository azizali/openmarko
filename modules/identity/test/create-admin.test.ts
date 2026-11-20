// `bun run admin:create`: the first admin of a new deploy, made without going through sign-up.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, type TestDb } from "@app/testkit";
import { authOf, createAdminUser } from "../src";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.teardown());

const row = async (email: string) =>
  (await t.ctx.pool.query(`select id, role, "emailVerified" from auth."user" where email = $1`, [email])).rows[0];

describe("createAdminUser", () => {
  test("makes a verified admin who can sign in with the password it returns, and owns an Organization", async () => {
    const r = await createAdminUser(t.ctx, { email: "First@Acme.dev", organization: { name: "Acme", slug: "acme" } });
    expect(r.password?.length).toBeGreaterThanOrEqual(20);
    expect(await row("first@acme.dev")).toMatchObject({ role: "admin", emailVerified: true });
    const si = await authOf(t.ctx).api.signInEmail({ body: { email: "first@acme.dev", password: r.password! } });
    expect(si.user.id).toBe(r.userId);
    const { rows } = await t.ctx.pool.query(`select role from auth.member where "userId" = $1 and "organizationId" = $2`, [
      r.userId,
      r.organizationId,
    ]);
    expect(rows).toEqual([{ role: "owner" }]);
  });

  test("running it again adds nothing and leaves the password", async () => {
    const r = await createAdminUser(t.ctx, { email: "first@acme.dev", organization: { name: "Acme", slug: "acme" } });
    expect(r).toMatchObject({ password: null, organizationId: null });
    const { rows } = await t.ctx.pool.query(`select count(*)::int as n from auth.organization where slug like 'acme%'`);
    expect(rows[0].n).toBe(1);
  });

  test("an existing person becomes an admin, and a taken slug doesn't stop their Organization", async () => {
    await authOf(t.ctx).api.signUpEmail({ body: { email: "later@acme.dev", password: "password-123", name: "Later" } });
    const r = await createAdminUser(t.ctx, { email: "later@acme.dev", organization: { name: "Acme two", slug: "acme" } });
    expect(r.password).toBeNull();
    expect(r.organizationId).toBeTruthy();
    expect((await row("later@acme.dev")).role).toBe("admin");
  });
});
