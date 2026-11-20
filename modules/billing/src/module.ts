import { defineModule, type AppContext, type Billing } from "@app/kernel";
import { assertMeterAllowed, checkLimit, entitlementsFor, featureAllowedByPlan } from "./entitlements";
import { costOfRun, recordUsage } from "./service";
import { billingRoutes } from "./routes";

/** What the kernel's `billingOf(ctx)` answers while this module runs. */
export const billingFor = (ctx: AppContext): Billing => ({
  enabled: true,
  entitlementsFor: (orgId) => entitlementsFor(ctx, orgId),
  featureAllowed: featureAllowedByPlan,
  checkLimit,
  assertMeterAllowed: async (orgId, meter, quantity, opts) => void (await assertMeterAllowed(ctx, orgId, meter, quantity, opts)),
  recordUsage,
  costOfRun: (runId) => costOfRun(ctx, runId),
});

export const billingModule = defineModule({
  id: "billing",
  apiGroup: { name: "Billing", description: "Plans, entitlements, checkout and usage." },
  events: [{ id: "subscription.changed", label: "An Organization's Plan changed" }],
  permissions: [
    {
      id: "billing",
      label: "Billing",
      group: "organization",
      actions: [
        { id: "view", label: "See plan and invoices", tier: "view" },
        { id: "update", label: "Change plan and payment", tier: "manage", ownerOnly: true },
      ],
    },
  ],
  setup: (ctx) => {
    ctx.billing = billingFor(ctx);
    return { routes: billingRoutes(ctx) };
  },
});
