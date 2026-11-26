// Test helpers: a throwaway database per test file, fully migrated, dropped afterwards.
// Point TEST_DATABASE_URL at any Postgres you can create databases on (default: local Docker on 5433).
import { Pool } from "pg";
import { createAppContext, loadConfig, migrateDrizzle, type AppContext, type Config } from "@app/kernel";
import { authOf, closeAuth, migrateAuth } from "@app/identity";
import { compose, moduleCatalog } from "@app/server";

const adminUrl = process.env.TEST_DATABASE_URL ?? "postgres://postgres:dev@localhost:5433/postgres";

export type TestDb = { ctx: AppContext; cfg: Config; teardown: () => Promise<void> };

export type EmptyDb = { url: string; drop: () => Promise<void> };

/** A new, empty database (nothing migrated). For tests that set up their own schema. */
export async function createEmptyDb(): Promise<EmptyDb> {
  const name = `app_test_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      const a = new Pool({ connectionString: adminUrl, max: 1 });
      // `pool.end()` resolves before its connections have closed. Forcing the drop while one is still closing
      // terminates it, and that surfaces as an unhandled error between tests. So wait (briefly) for them to go.
      for (let i = 0; i < 50; i++) {
        const { rows } = await a.query("select count(*)::int as n from pg_stat_activity where datname = $1", [name]);
        if (rows[0].n === 0) break;
        await Bun.sleep(20);
      }
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

/** The app's test environment. ADMIN_EMAILS makes `admin@app.test` an app admin on sign-up. */
export const TEST_ENV = {
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:5173",
  MASTER_KEY_CURRENT: "1",
  MASTER_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
  ADMIN_EMAILS: "admin@app.test",
};

export async function createTestDb(env: Record<string, string> = {}): Promise<TestDb> {
  const empty = await createEmptyDb();
  const cfg = loadConfig({ DATABASE_URL: empty.url, ...TEST_ENV, ...env });
  const ctx = createAppContext(cfg);
  // Composed as the app is, so every module's hooks (billing, knowledge, email, guards) are in place; a test that
  // builds the API composes again, which is harmless (module setup is idempotent).
  ctx.catalog = moduleCatalog(cfg);
  compose(ctx);
  ctx.enqueue = async () => {}; // nothing runs jobs in tests unless a test says so
  await migrateAuth(cfg);
  await migrateDrizzle(ctx.db);
  return {
    ctx,
    cfg,
    teardown: async () => {
      await closeAuth(ctx);
      await ctx.pool.end();
      await empty.drop();
    },
  };
}

export type Session = { userId: string; orgId: string; headers: Headers; email: string };

let seq = 0;
const cookieOf = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((c: string) => c.split(";")[0])
    .join("; ");

/** Signs a fresh user up and in. Returns the headers a request needs to act as them. */
export async function userSession(ctx: AppContext, opts: { email?: string; name?: string } = {}) {
  const auth = authOf(ctx);
  seq++;
  const email = opts.email ?? `person${seq}-${crypto.randomUUID().slice(0, 6)}@app.test`;
  const password = "password-123";
  // An email used before (the admin's, say) just signs in again.
  await auth.api.signUpEmail({ body: { email, password, name: opts.name ?? "Person" } }).catch(() => undefined);
  const si = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  return { userId: si.response.user.id, email, headers: new Headers({ cookie: cookieOf(si.headers), origin: ctx.cfg.appUrl }) };
}

/** Signs up a fresh user, signs them in and creates an Organization they own. */
export async function ownerSession(ctx: AppContext, opts: { orgName?: string; email?: string } = {}): Promise<Session> {
  const u = await userSession(ctx, { email: opts.email, name: "Owner" });
  const org = await authOf(ctx).api.createOrganization({
    body: { name: opts.orgName ?? "Maple & Main", slug: `org-${crypto.randomUUID().slice(0, 8)}`, timezone: "America/Chicago" },
    headers: u.headers,
  });
  return { userId: u.userId, orgId: (org as { id: string }).id, headers: u.headers, email: u.email };
}

/** A platform admin's session: the one email ADMIN_EMAILS lists in tests. */
export async function adminSession(ctx: AppContext) {
  return userSession(ctx, { email: "admin@app.test", name: "Admin" });
}

/** A request helper that sends through the composed app, with a session's cookies and JSON body. */
export function requester(app: { handle: (r: Request) => Promise<Response> | Response }, base = "http://localhost:3000") {
  return async (method: string, path: string, opts: { headers?: Headers; body?: unknown } = {}) => {
    const headers = new Headers(opts.headers);
    const url = new URL(path, base);
    headers.set("host", url.host);
    if (opts.body !== undefined) headers.set("content-type", "application/json");
    const res = await app.handle(
      new Request(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
    );
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, text };
  };
}

/** The whole API, composed for this context. */
export async function composedApp(ctx: AppContext) {
  const { buildApi, compose } = await import("@app/server");
  return buildApi(ctx, compose(ctx));
}
