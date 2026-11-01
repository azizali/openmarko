import { newId } from "./ids";
import { activity } from "./schema";
import type { Tx } from "./db";

export type ActivityInput = {
  organizationId: string;
  actorType: "member" | "assistant" | "system" | "partner_staff";
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  locationId?: string | null;
  summary: string;
  data?: Record<string, unknown> | null;
};

/** Writes an Activity row in the caller's transaction (schema.md, core.activity). */
export async function logActivity(tx: Tx, input: ActivityInput): Promise<void> {
  await tx.insert(activity).values({
    id: newId(),
    organizationId: input.organizationId,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    locationId: input.locationId ?? null,
    summary: input.summary,
    data: input.data ?? null,
  });
}
