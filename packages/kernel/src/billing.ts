// What every module asks about Plans, without importing the billing module (which may be off). The billing module
// puts its real answers on ctx.billing at boot; without it, `unlimitedBilling` applies: every feature allowed, no
// limits, nothing metered or blocked, usage still recorded nowhere.
import type { AppContext } from "./module";
import type { Db, Tx } from "./db";

/** key → value. A missing key means: features are off (with billing) or on (without), actions allowed, limits unlimited. */
export type Entitlements = Map<string, number | null>;

export type UsageInput = {
  organizationId: string;
  meter: string;
  quantity: number;
  costMicros: number;
  provider: string;
  mode: "live" | "stub";
  runId?: string | null;
  meta?: Record<string, unknown> | null;
};

export type Billing = {
  /** Whether the billing module is running. The web app hides Plans and billing pages otherwise. */
  enabled: boolean;
  /** The Organization's Plan with its overrides. */
  entitlementsFor(orgId: string): Promise<Entitlements>;
  /** Whether the Plan allows a feature (`feature.<id>` = 1). */
  featureAllowed(ent: Entitlements, feature: string): boolean;
  /** Throws plan_limit when the count is at the Plan's `limit.<key>`. */
  checkLimit(ent: Entitlements, key: string, current: number): void;
  /** Metered use: throws plan_limit when the Plan blocks it. `byok`: the call uses the Organization's own key. */
  assertMeterAllowed(orgId: string, meter: string, quantity: number, opts: { byok: boolean }): Promise<void>;
  /** Records one metered call. Works with the app's connection or inside a transaction. */
  recordUsage(db: Db | Tx, input: UsageInput): Promise<void>;
  /** What a Run cost: the sum of the usage it caused. */
  costOfRun(runId: string): Promise<number>;
};

/** Billing when the module is off: everything is allowed and free. */
export const unlimitedBilling: Billing = {
  enabled: false,
  entitlementsFor: async () => new Map(),
  featureAllowed: () => true,
  checkLimit: () => undefined,
  assertMeterAllowed: async () => undefined,
  recordUsage: async () => undefined,
  costOfRun: async () => 0,
};

/** The billing in this process: the module's, or unlimited. */
export const billingOf = (ctx: AppContext): Billing => ctx.billing ?? unlimitedBilling;
