// Partners (ADR 0004, ADR 0011, ADR 0023): a Partner creates its Clients, shows them its brand, and a Client
// can leave with a say over which partner people keep access.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";
import { authMember, authOrganization } from "@app/kernel";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { addMember } from "@app/organizations";
import { transferOut, transferOutPreview } from "../src";

let t: TestDb;
let call: ReturnType<typeof requester>;
const actor = (s: Session) => ({ orgId: s.orgId, userId: s.userId });

/** A Partner on the Partner Plan. */
async function partner(name: string) {
  const p = await ownerSession(t.ctx, { orgName: name });
  await assignPlanManually(t.ctx, p.orgId, "partner");
  return p;
}

/** Makes an existing Organization a Partner's Client. */
const asClient = (p: Session, client: Session) =>
  t.ctx.db.update(authOrganization).set({ partnerId: p.orgId }).where(eq(authOrganization.id, client.orgId));

beforeAll(async () => {
  t = await createTestDb();
  call = requester(await composedApp(t.ctx));
  await upsertPlan(t.ctx, { id: "partner", name: "Partner", entitlements: { partner: 1 } });
});
afterAll(() => t.teardown());

describe("Partners and Clients: creating them, then transfer out with per-person revoke (ADR 0011)", () => {
  test("a Partner creates a Client and owns it until it hands over; other Organizations can't", async () => {
    const newClient = (s: Session, name: string, slug: string) =>
      call("POST", `/api/v1/organizations/${s.orgId}/clients`, { headers: s.headers, body: { name, slug, timezone: "UTC" } });
    const plain = await ownerSession(t.ctx, { orgName: "Not a partner" });
    expect((await newClient(plain, "Nope", "nope-client")).status).toBe(402);

    const p = await partner("Brightline");
    const created = await newClient(p, "Hill Country Plumbing", "hill-country");
    expect(created.status).toBe(200);
    const [org] = await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, created.body.id));
    expect(org!.partnerId).toBe(p.orgId);
    const [owner] = await t.ctx.db
      .select()
      .from(authMember)
      .where(and(eq(authMember.organizationId, created.body.id), eq(authMember.userId, p.userId)));
    expect(owner!.role).toBe("owner");
    const clients = await call("GET", `/api/v1/organizations/${p.orgId}/partner`, { headers: p.headers });
    expect(clients.body).toMatchObject({
      partner: true,
      clients: [expect.objectContaining({ name: "Hill Country Plumbing", members: 1 })],
    });

    expect((await newClient(p, "Same slug", "hill-country")).status).toBe(409);
  });

  test("transfer out previews the partner members and revokes the ones the Client chooses", async () => {
    const p = await partner("P4");
    const client = await ownerSession(t.ctx, { orgName: "C4" });
    await asClient(p, client);
    const agent = await ownerSession(t.ctx, { orgName: "Partner staff" });
    await addMember(t.ctx, p.orgId, agent.userId, "admin");
    await addMember(t.ctx, client.orgId, agent.userId, "editor");

    const preview = await transferOutPreview(t.ctx, client.orgId);
    expect(preview.partnerId).toBe(p.orgId);
    expect(preview.members.map((m) => m.userId)).toEqual([agent.userId]);
    await expect(transferOut(t.ctx, actor(client), client.orgId, [crypto.randomUUID()])).rejects.toMatchObject({ status: 422 });

    await transferOut(t.ctx, actor(client), client.orgId, [agent.userId]);
    const [org] = await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, client.orgId));
    expect(org!.partnerId).toBeNull();
    const left = await t.ctx.db
      .select()
      .from(authMember)
      .where(and(eq(authMember.organizationId, client.orgId), eq(authMember.userId, agent.userId)));
    expect(left.length).toBe(0);
  });
});

describe("whitelabel brand (ADR 0004)", () => {
  test("a Partner and its Clients work under its brand", async () => {
    const applied = async (s: Session) =>
      (await call("GET", `/api/v1/organizations/${s.orgId}/brand/applied`, { headers: s.headers })).body;
    const p = await partner("Lakeshore");
    // Nothing saved yet: the app's own.
    expect(await applied(p)).toMatchObject({ whitelabel: false });

    await call("PUT", `/api/v1/organizations/${p.orgId}/brand`, { headers: p.headers, body: { name: "Lakeshore", accent: "#1d4ed8" } });
    expect(await applied(p)).toMatchObject({ whitelabel: true, partnerId: p.orgId, brand: { name: "Lakeshore", accent: "#1d4ed8" } });

    const client = await ownerSession(t.ctx, { orgName: "Lakeshore Client" });
    expect(await applied(client)).toMatchObject({ whitelabel: false });
    await asClient(p, client);
    expect(await applied(client)).toMatchObject({ whitelabel: true, partnerId: p.orgId, brand: { accent: "#1d4ed8" } });
  });

  test("partner staff have their partner wherever they work; a Client's own people don't", async () => {
    const partners = async (s: Session) => (await call("GET", "/api/v1/me/partners", { headers: s.headers })).body;
    const p = await partner("Summit");
    const client = await ownerSession(t.ctx, { orgName: "Summit Client" });
    await asClient(p, client);

    const listed = await call("GET", `/api/v1/organizations/${p.orgId}/partner`, { headers: p.headers });
    expect(listed.body.clients).toMatchObject([{ id: client.orgId, members: 1 }]);

    expect(await partners(p)).toEqual([{ id: p.orgId, name: "Summit" }]);
    expect(await partners(client)).toEqual([]);
    expect((await call("GET", "/api/v1/me/partners")).status).toBe(401);
  });

  test("without a Partner Plan an Organization can't save a brand", async () => {
    const plain = await ownerSession(t.ctx, { orgName: "No Plan" });
    const saved = await call("PUT", `/api/v1/organizations/${plain.orgId}/brand`, { headers: plain.headers, body: { name: "Sneaky" } });
    expect(saved.status).toBeGreaterThanOrEqual(400);
    const r = await call("GET", `/api/v1/organizations/${plain.orgId}/brand/applied`, { headers: plain.headers });
    expect(r.body).toMatchObject({ whitelabel: false });
  });

  test("a Client on its Partner's Plan isn't a Partner: no Whitelabel of its own, and it keeps showing the Partner's", async () => {
    const p = await partner("Harbor");
    await call("PUT", `/api/v1/organizations/${p.orgId}/brand`, { headers: p.headers, body: { name: "Harbor", accent: "#0f766e" } });
    const client = await ownerSession(t.ctx, { orgName: "Harbor Client" });
    await asClient(p, client);

    const status = await call("GET", `/api/v1/organizations/${client.orgId}/partner`, { headers: client.headers });
    expect(status.body.partner).toBe(false);
    const saved = await call("PUT", `/api/v1/organizations/${client.orgId}/brand`, { headers: client.headers, body: { name: "Mine" } });
    expect(saved.status).toBeGreaterThanOrEqual(400);
    const nested = await call("POST", `/api/v1/organizations/${client.orgId}/clients`, {
      headers: client.headers,
      body: { name: "Too deep", slug: "too-deep", timezone: "UTC" },
    });
    expect(nested.status).toBe(402);
    const applied = await call("GET", `/api/v1/organizations/${client.orgId}/brand/applied`, { headers: client.headers });
    expect(applied.body).toMatchObject({ partnerId: p.orgId, brand: { name: "Harbor", accent: "#0f766e" } });
  });
});
