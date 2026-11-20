import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createTestDb, ownerSession, requester, type TestDb, type Session } from "@app/testkit";
import { compose, buildApi, jobNames, startQueue } from "@app/server";
import { addMember } from "@app/organizations";

let t: TestDb;
let call: ReturnType<typeof requester>;
let owner: Session;
let composed: ReturnType<typeof compose>;

beforeAll(async () => {
  t = await createTestDb();
  composed = compose(t.ctx);
  call = requester(buildApi(t.ctx, composed));
  owner = await ownerSession(t.ctx, { orgName: "Hardening" });
});
afterAll(() => t.teardown());

async function joinAs(role: string) {
  const person = await ownerSession(t.ctx, { orgName: `${role} home` });
  await addMember(t.ctx, owner.orgId, person.userId, role);
  return person;
}

describe("people: nobody can take ownership they weren't given", () => {
  test("an Admin can't make anyone (or themselves) an owner", async () => {
    const admin = await joinAs("admin");
    const r = await call("PATCH", `/api/v1/organizations/${owner.orgId}/members/${admin.userId}`, {
      headers: admin.headers,
      body: { role: "owner" },
    });
    expect(r.status).toBe(403);
  });

  test("an Admin can't remove or demote an Owner", async () => {
    const admin = await joinAs("admin");
    expect((await call("DELETE", `/api/v1/organizations/${owner.orgId}/members/${owner.userId}`, { headers: admin.headers })).status).toBe(
      403,
    );
    expect(
      (
        await call("PATCH", `/api/v1/organizations/${owner.orgId}/members/${owner.userId}`, {
          headers: admin.headers,
          body: { role: "viewer" },
        })
      ).status,
    ).toBe(403);
  });

  test("the last Owner can't demote or remove themselves", async () => {
    const solo = await ownerSession(t.ctx, { orgName: "Solo" });
    expect(
      (
        await call("PATCH", `/api/v1/organizations/${solo.orgId}/members/${solo.userId}`, {
          headers: solo.headers,
          body: { role: "admin" },
        })
      ).status,
    ).toBe(409);
    expect((await call("DELETE", `/api/v1/organizations/${solo.orgId}/members/${solo.userId}`, { headers: solo.headers })).status).toBe(
      409,
    );
  });

  test("a role that doesn't exist here is refused", async () => {
    const viewer = await joinAs("viewer");
    const r = await call("PATCH", `/api/v1/organizations/${owner.orgId}/members/${viewer.userId}`, {
      headers: owner.headers,
      body: { role: "superuser" },
    });
    expect(r.status).toBe(422);
  });

  test("an Owner can make someone else an owner", async () => {
    const next = await joinAs("admin");
    expect(
      (
        await call("PATCH", `/api/v1/organizations/${owner.orgId}/members/${next.userId}`, {
          headers: owner.headers,
          body: { role: "owner" },
        })
      ).status,
    ).toBe(200);
    const roles = (await call("GET", `/api/v1/organizations/${owner.orgId}/members`, { headers: owner.headers })).body as {
      userId: string;
      role: string;
      email: string;
    }[];
    expect(roles.find((m) => m.userId === next.userId)).toMatchObject({ role: "owner", email: next.email });
  });
});

describe("robust edges", () => {
  test("the organization switcher needs a session (401, not an empty list)", async () => {
    expect((await call("GET", "/api/v1/me/organizations")).status).toBe(401);
  });

  test("a webhook with a body that isn't JSON is a 400, not a 500", async () => {
    // The app's Slack account signs its webhooks with the secret kept on that Connection.
    const { connect } = await import("@app/integrations");
    await connect(t.ctx, {
      organizationId: null,
      providerId: "slack",
      target: { type: "app", id: null },
      label: "Slack",
      secrets: { webhookUrl: "https://hooks.slack.com/x", webhookSecret: "0123456789abcdef" },
    });
    const { hmacHex } = await import("@app/kernel");
    const body = "not json";
    const res = await buildApi(t.ctx, composed).handle(
      new Request("http://localhost:3000/api/v1/webhooks/slack", {
        method: "POST",
        body,
        headers: { host: "localhost:3000", "x-webhook-signature": hmacHex("0123456789abcdef", body) },
      }),
    );
    expect(res.status).toBe(400);
  });

  test("a browser from an unknown origin gets no CORS headers; the app's origin does", async () => {
    const api = buildApi(t.ctx, composed);
    const evil = await api.handle(new Request("http://localhost:3000/health", { headers: { origin: "https://evil.test" } }));
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    const ok = await api.handle(new Request("http://localhost:3000/health", { headers: { origin: t.cfg.appUrl } }));
    expect(ok.headers.get("access-control-allow-origin")).toBe(t.cfg.appUrl);
    const pre = await api.handle(
      new Request("http://localhost:3000/api/v1/me", { method: "OPTIONS", headers: { origin: "https://evil.test" } }),
    );
    expect(pre.status).toBe(403);
  });

  test("readiness reports whether the database is reachable", async () => {
    const r = await call("GET", "/ready");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ready: true });
  });

  test("the API's queue client writes jobs the worker will pick up", async () => {
    const queue = await startQueue(t.cfg.databaseUrl, jobNames(composed), { runs: false });
    try {
      await queue.enqueue("messaging.send", { to: "x@y.test" }, { organizationId: owner.orgId });
      const rows = await t.ctx.db.execute(sql`select count(*)::int as n from pgboss.job where name = 'messaging.send'`);
      expect((rows.rows[0] as { n: number }).n).toBe(1);
    } finally {
      await queue.stop();
    }
  });
});
