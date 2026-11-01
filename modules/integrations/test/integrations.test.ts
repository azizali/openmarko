import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { AppError } from "@openmarko/kernel";
import { assignPlanManually, upsertPlan, usageEvents } from "@openmarko/billing";
import { connect, disconnect, invoke, listConnections, pickConnection } from "../src";
import { createLocation } from "@openmarko/organizations";
import { connections, credentials } from "../src/schema";
import { and, eq } from "drizzle-orm";

let t: TestDb;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx);
  await upsertPlan(t.ctx, {
    id: "metered",
    name: "Metered",
    entitlements: { "feature.seo": 1 },
    meters: [
      { meter: "dataforseo.request", included: null, overage: "charge", unitPriceMicros: 0 },
      { meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 },
    ],
  });
  await assignPlanManually(t.ctx, owner.orgId, "metered");
});
afterAll(() => t.teardown());

describe("the one path to a provider: invoke (ADR 0002)", () => {
  test("calling a capability with nothing connected says Connect, with the capability named", async () => {
    const err = await invoke(t.ctx, owner.orgId, "serp.read", { kind: "organic", keyword: "dentist", domain: "mapleandmain.com" }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ needs: "serp.read" });
  });

  test("after connecting DataForSEO (stub), the call works and is metered", async () => {
    await connect(t.ctx, {
      organizationId: owner.orgId,
      providerId: "dataforseo",
      target: { type: "organization", id: owner.orgId },
      label: "DataForSEO",
      secrets: { login: "u", password: "p" },
    });
    const res = await invoke<{ domain: string; rank: number }[]>(t.ctx, owner.orgId, "serp.read", {
      kind: "organic",
      keyword: "dentist austin",
      domain: "mapleandmain.com",
    });
    expect(res.mode).toBe("stub");
    expect(Array.isArray(res.output)).toBe(true);
    const rows = await t.ctx.db
      .select()
      .from(usageEvents)
      .where(and(eq(usageEvents.organizationId, owner.orgId), eq(usageEvents.meter, "dataforseo.request")));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.mode).toBe("stub");
  });

  test("the stub is deterministic: the same keyword gives the same results", async () => {
    const a = await invoke(t.ctx, owner.orgId, "serp.read", { kind: "organic", keyword: "implants", domain: "x.test" });
    const b = await invoke(t.ctx, owner.orgId, "serp.read", { kind: "organic", keyword: "implants", domain: "x.test" });
    expect(a.output).toEqual(b.output);
  });

  test("a free integration writes no usage (metering rule, ADR 0012)", async () => {
    const locationId = await createLocation(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "South Congress" });
    await connect(t.ctx, {
      organizationId: owner.orgId,
      providerId: "gbp",
      target: { type: "location", id: locationId },
      externalId: "locations/1",
      label: "GBP",
    });
    const before = await t.ctx.db.select().from(usageEvents).where(eq(usageEvents.organizationId, owner.orgId));
    await invoke(t.ctx, owner.orgId, "reviews.read", {}, { connectionId: (await pickConnection(t.ctx, owner.orgId, "reviews.read"))!.id });
    const after = await t.ctx.db.select().from(usageEvents).where(eq(usageEvents.organizationId, owner.orgId));
    expect(after.length).toBe(before.length);
  });
});

describe("connections and secrets (ADR 0002, ADR 0010)", () => {
  test("secrets are stored encrypted: the plaintext is not in the database", async () => {
    const [row] = await t.ctx.db
      .select()
      .from(credentials)
      .innerJoin(connections, eq(connections.id, credentials.connectionId))
      .where(eq(connections.providerId, "dataforseo"));
    const blob = row!.credentials.ciphertext.toString("utf8") + row!.credentials.wrappedKey.toString("utf8");
    expect(blob).not.toContain('"password":"p"');
  });

  test("a 'max one' capability replaces the connection that served it for the same target", async () => {
    const firstId = (await pickConnection(t.ctx, owner.orgId, "serp.read"))!.id;
    await connect(t.ctx, {
      organizationId: owner.orgId,
      providerId: "dataforseo",
      target: { type: "organization", id: owner.orgId },
      label: "DataForSEO v2",
      secrets: { login: "u2", password: "p2" },
    });
    const nowId = (await pickConnection(t.ctx, owner.orgId, "serp.read"))!.id;
    expect(nowId).not.toBe(firstId);
    const live = (await listConnections(t.ctx, owner.orgId)).filter((c) => c.providerId === "dataforseo");
    expect(live.length).toBe(1);
  });

  test("disconnecting removes the secret and the connection stops serving", async () => {
    const id = (await pickConnection(t.ctx, owner.orgId, "serp.read"))!.id;
    await disconnect(t.ctx, owner.orgId, id, owner.userId);
    expect(await pickConnection(t.ctx, owner.orgId, "serp.read")).toBeNull();
    const left = await t.ctx.db.select().from(credentials).where(eq(credentials.connectionId, id));
    expect(left.length).toBe(0);
  });

  test("an Organization without its own key uses the platform default for LLM calls", async () => {
    await connect(t.ctx, {
      organizationId: null,
      providerId: "platform_llm",
      target: { type: "platform", id: null },
      label: "Platform default",
      secrets: { apiKey: "k", vendor: "anthropic" },
    });
    const picked = await pickConnection(t.ctx, owner.orgId, "llm.complete");
    expect(picked?.organizationId).toBeNull();
    expect(picked?.providerId).toBe("platform_llm");
    const res = await invoke<{ text: string }>(t.ctx, owner.orgId, "llm.complete", { prompt: "Write a reply." });
    expect(res.output.text).toContain("[stub]");
  });

  test("an unknown webhook is stored once even if the provider retries", async () => {
    const { storeWebhook } = await import("../src");
    expect(await storeWebhook(t.ctx, "dataforseo", "evt-1", { a: 1 })).toBe(true);
    expect(await storeWebhook(t.ctx, "dataforseo", "evt-1", { a: 1 })).toBe(false);
  });
});
