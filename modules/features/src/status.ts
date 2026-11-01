// Is a feature on? Three answers that stay separate (ADR 0006), plus the Plan (ADR 0012):
//   1. the Plan allows it (feature.<id> = 1)
//   2. the Organization has it switched on (organization.features), its module is on, and what it needs is on
// Being connected (step 3) is checked by the route that needs it, not here.
import { features, type FeatureId } from "@openmarko/shared";
import { featureAllowedByPlan, type Entitlements } from "@openmarko/billing";

export type OrgFeatures = Record<string, boolean> | null | undefined;

export type FeatureStatus = { on: boolean; why?: string };

const byId = new Map(features.map((f) => [f.id, f]));

function switchedOn(id: FeatureId, org: OrgFeatures): boolean {
  return (org ?? {})[id] !== false;
}

/** Pure: decides from the Organization's switches and its Plan. */
export function statusOf(id: FeatureId, org: OrgFeatures, ent: Entitlements): FeatureStatus {
  const f = byId.get(id);
  if (!f) return { on: false, why: "unknown feature" };
  if (!featureAllowedByPlan(ent, id)) return { on: false, why: "not in your plan" };
  if (!switchedOn(id, org)) return { on: false, why: "turned off" };
  if (f.module) {
    const parent = statusOf(f.module, org, ent);
    if (!parent.on) return { on: false, why: parent.why ?? "module off" };
  }
  if (f.needsAny?.length) {
    const any = f.needsAny.some((n) => statusOf(n, org, ent).on);
    if (!any) return { on: false, why: `needs ${f.needsAny.join(" or ")}` };
  }
  return { on: true };
}

/** Every feature's status, for the Features page and for jobs that check before they run. */
export function allStatuses(org: OrgFeatures, ent: Entitlements): Record<string, FeatureStatus> {
  return Object.fromEntries(features.map((f) => [f.id, statusOf(f.id, org, ent)]));
}
