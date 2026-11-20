import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type TestDb, type Session } from "@app/testkit";
import { AppError } from "@app/kernel";
import { assignPlanManually, upsertPlan, usageEvents } from "@app/billing";
import { appCredentials, connect, disconnect, invoke, listConnections, pickConnection } from "../src";
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
    entitlements: {},
    meters: [
      { meter: "email.sent", included: null, overage: "charge", unitPriceMicros: 0 },
      { meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 },
    ],
  });
  await assignPlanManually(t.ctx, owner.orgId, "metered");
});
afterAll(() => t.teardown());

const mail = { to: "a@b.test", subject: "Hi", text: "Hello", from: { email: "hello@app.test", name: "App" } };

describe("the one path to a provider: invoke (ADR 0002)", () => {
  test("calling a capability with nothing connected says Connect, with the capability named", async () => {
    const err = await invoke(t.ctx, owner.orgId, "email.send", mail).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ needs: "email.send" });
  });

  test("after connecting a provider (stub), the call works and is metered", async () => {
    await connect(t.ctx, {
      organizationId: owner.orgId,
      providerId: "resend",
      target: { type: "organization", id: owner.orgId },
      label: "Resend",
      secrets: { key: "re_x" },
    });
    const res = await invoke<{ messageId: string }>(t.ctx, owner.orgId, "email.send", mail);
    expect(res.mode).toBe("stub");
    expect(res.output.messageId).toMatch(/^stub-/);
    const rows = await t.ctx.db
      .select()
      .from(usageEvents)
      .where(and(eq(usageEvents.organizationId, owner.orgId), eq(usageEvents.meter, "email.sent")));
    expect(rows.length).toBe(1);
    // The Organization's own key: its usage isn't the app's cost.
    expect(rows[0]!).toMatchObject({ mode: "stub", provider: "resend", costMicros: 0 });
  });

  test("a free provider (Slack) is called and nothing is metered", async () => {
    await connect(t.ctx, {
      organizationId: owner.orgId,
      providerId: "slack",
      target: { type: "organization", id: owner.orgId },
      label: "Alerts",
      secrets: { webhookUrl: "https://hooks.slack.com/x" },
    });
    expect((await invoke(t.ctx, owner.orgId, "notify.send", { text: "hi" })).output).toEqual({ delivered: true });
    const rows = await t.ctx.db.select().from(usageEvents).where(eq(usageEvents.organizationId, owner.orgId));
    expect(rows.map((r) => r.meter)).toEqual(["email.sent"]);
  });

  test("the app's own Connection serves Organizations without one, and its cost is the app's", async () => {
    const other = await ownerSession(t.ctx, { orgName: "No key" });
    await assignPlanManually(t.ctx, other.orgId, "metered");
    expect(await pickConnection(t.ctx, other.orgId, "email.send")).toBeNull();
    await connect(t.ctx, {
      organizationId: null,
      providerId: "postmark",
      target: { type: "app", id: null },
      label: "App Postmark",
      secrets: { key: "pm", webhookSecret: "0123456789abcdef" },
    });
    expect((await pickConnection(t.ctx, other.orgId, "email.send"))?.providerId).toBe("postmark");
    expect((await pickConnection(t.ctx, owner.orgId, "email.send"))?.providerId).toBe("resend");
    expect(await appCredentials(t.ctx, "postmark")).toEqual({ key: "pm", webhookSecret: "0123456789abcdef" });
    const res = await invoke(t.ctx, other.orgId, "email.send", mail);
    expect(res.provider).toBe("postmark");
    const [row] = await t.ctx.db.select().from(usageEvents).where(eq(usageEvents.organizationId, other.orgId));
    expect(row!.costMicros).toBeGreaterThan(0);
  });

  test("a Plan that doesn't sell the meter blocks the call; the Organization's own key gets through", async () => {
    const bare = await ownerSession(t.ctx, { orgName: "Bare" });
    await upsertPlan(t.ctx, { id: "bare", name: "Bare", entitlements: {} });
    await assignPlanManually(t.ctx, bare.orgId, "bare");
    await expect(invoke(t.ctx, bare.orgId, "email.send", mail)).rejects.toMatchObject({ status: 402 });
    await connect(t.ctx, {
      organizationId: bare.orgId,
      providerId: "resend",
      target: { type: "organization", id: bare.orgId },
      label: "Own",
      secrets: { key: "k" },
    });
    expect((await invoke(t.ctx, bare.orgId, "email.send", mail)).mode).toBe("stub");
  });

  test("a provider's secret is stored encrypted and removed on disconnect", async () => {
    const [c] = await t.ctx.db
      .select()
      .from(connections)
      .where(and(eq(connections.organizationId, owner.orgId), eq(connections.providerId, "resend")));
    const [cred] = await t.ctx.db.select().from(credentials).where(eq(credentials.connectionId, c!.id));
    expect(cred!.ciphertext.toString()).not.toContain("re_x");
    await disconnect(t.ctx, owner.orgId, c!.id, owner.userId);
    expect((await t.ctx.db.select().from(credentials).where(eq(credentials.connectionId, c!.id))).length).toBe(0);
    expect((await listConnections(t.ctx, owner.orgId)).map((x) => x.providerId)).toEqual(["slack"]);
  });

  test("a provider that can't attach where it's asked is refused", async () => {
    await expect(
      connect(t.ctx, {
        organizationId: owner.orgId,
        providerId: "nope" as never,
        target: { type: "organization", id: owner.orgId },
        label: "x",
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      connect(t.ctx, { organizationId: owner.orgId, providerId: "resend", target: { type: "app", id: null }, label: "x" }),
    ).rejects.toMatchObject({
      status: 422,
    });
  });
});
