// Test helpers: a throwaway database per test file, fully migrated, dropped afterwards.
// Point TEST_DATABASE_URL at any Postgres you can create databases on (default: local Docker on 5433).
import { Pool } from "pg";
import { createAppContext, loadConfig, type AppContext, type Config } from "@openmarko/kernel";
import { migrateAuth } from "@openmarko/identity";
import { migrateDrizzle } from "@openmarko/kernel";
import { closeAuth } from "@openmarko/identity";

const adminUrl = process.env.TEST_DATABASE_URL ?? "postgres://postgres:dev@localhost:5433/postgres";

export type TestDb = { ctx: AppContext; cfg: Config; teardown: () => Promise<void> };

export async function createTestDb(): Promise<TestDb> {
  const name = `om_test_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const cfg = loadConfig({
    DATABASE_URL: url.toString(),
    BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
    BETTER_AUTH_URL: "http://localhost:3000",
    MASTER_KEY_CURRENT: "1",
    MASTER_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
    PLATFORM_ADMIN_TOKEN: "test-admin-token-0123456789abcdef0123456789",
    TRUSTED_ORIGINS: "",
    PROVIDERS: "stub",
  });
  const ctx = createAppContext(cfg);
  await migrateAuth(cfg);
  await migrateDrizzle(ctx.db);

  return {
    ctx,
    cfg,
    teardown: async () => {
      await closeAuth(ctx);
      await ctx.pool.end();
      const a = new Pool({ connectionString: adminUrl, max: 1 });
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export type Session = { userId: string; orgId: string; headers: Headers; email: string };

let seq = 0;
/**
 * Signs up a fresh user, signs them in and creates an Organization they own.
 * Returns the headers a request needs to act as that user.
 */
export async function ownerSession(ctx: AppContext, opts: { orgName?: string; category?: string } = {}): Promise<Session> {
  const { authFor } = await import("@openmarko/identity");
  const auth = authFor(ctx);
  seq++;
  const email = `owner${seq}-${crypto.randomUUID().slice(0, 6)}@maple.test`;
  const password = "password-123";
  const signedUp = await auth.api.signUpEmail({ body: { email, password, name: "Owner" } });
  const si = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  const cookie = si.headers
    .getSetCookie()
    .map((c: string) => c.split(";")[0])
    .join("; ");
  const headers = new Headers({ cookie });
  const org = await auth.api.createOrganization({
    body: {
      name: opts.orgName ?? "Maple & Main Dental",
      slug: `org-${crypto.randomUUID().slice(0, 8)}`,
      category: opts.category ?? "Dentist",
      timezone: "America/Chicago",
    },
    headers,
  });
  return { userId: signedUp.user.id, orgId: (org as { id: string }).id, headers, email };
}

/** A request helper that sends through the composed app, with a session's cookies and JSON body. */
export function requester(app: { handle: (r: Request) => Promise<Response> | Response }, base = "http://localhost") {
  return async (method: string, path: string, opts: { headers?: Headers; body?: unknown } = {}) => {
    const headers = new Headers(opts.headers);
    if (opts.body !== undefined) headers.set("content-type", "application/json");
    const res = await app.handle(
      new Request(`${base}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
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
