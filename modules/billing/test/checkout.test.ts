import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { AppError } from "@openmarko/kernel";
import { startStripeCheckout, upsertPlan } from "../src";
import type { StripeClient } from "../src/providers";

let t: TestDb;
let owner: Session;
let created = { customers: 0, subs: 0 };
const fake: StripeClient = {
  async createCustomer() {
    created.customers++;
    return { id: "cus_1" };
  },
  async createSubscription() {
    created.subs++;
    return { id: `sub_${created.subs}`, status: "incomplete", current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 };
  },
};

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx);
  await upsertPlan(t.ctx, {
    id: "stripe-plan",
    name: "Stripe plan",
    entitlements: { "feature.seo": 1 },
    prices: [{ interval: "month", amountCents: 9900, providerPriceId: "price_123" }],
  });
  await upsertPlan(t.ctx, { id: "no-price", name: "No price", entitlements: {}, prices: [{ interval: "month", amountCents: 100 }] });
});
afterAll(() => t.teardown());

describe("Stripe checkout", () => {
  test("starts a subscription stored as incomplete, on the chosen Plan, with one customer per Organization", async () => {
    const r = await startStripeCheckout(t.ctx, fake, { orgId: owner.orgId, planId: "stripe-plan", email: "owner@maple.test" });
    expect(r.status).toBe("incomplete");
    const again = await startStripeCheckout(t.ctx, fake, { orgId: owner.orgId, planId: "stripe-plan", email: "owner@maple.test" });
    expect(again.subscriptionId).not.toBe(r.subscriptionId);
    expect(created.customers).toBe(1);
  });

  test("a Plan with no Stripe price can't be started", async () => {
    const err = await startStripeCheckout(t.ctx, fake, { orgId: owner.orgId, planId: "no-price", email: "x@y.test" }).catch(
      (e: AppError) => e,
    );
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
  });

  test("the checkout route refuses when Stripe isn't configured", async () => {
    const { compose, buildApi } = await import("@openmarko/platform");
    const { requester } = await import("@openmarko/testkit");
    const app = buildApi(t.ctx, compose(t.ctx));
    delete process.env.STRIPE_SECRET_KEY;
    const r = await requester(app)("POST", `/api/v1/organizations/${owner.orgId}/billing/checkout`, {
      headers: owner.headers,
      body: { planId: "stripe-plan", email: "o@maple.test" },
    });
    expect(r.status).toBe(503);
  });
});
