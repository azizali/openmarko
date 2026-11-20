import { newId } from "./ids";
import { activity } from "./schema";
import type { Tx } from "./db";

export type ActorType = "member" | "assistant" | "system" | "admin";

export type ActivityInput = {
  /** The Organization it happened in. Omit for something that happened to the app itself (an admin's change). */
  organizationId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  summary: string;
  data?: Record<string, unknown> | null;
};

/** Writes an Activity row in the caller's transaction (schema.md, core.activity). */
export async function logActivity(tx: Tx, input: ActivityInput): Promise<void> {
  await tx.insert(activity).values({
    id: newId(),
    organizationId: input.organizationId ?? null,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    summary: input.summary,
    data: input.data ?? null,
  });
}
