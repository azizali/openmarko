import type { AppContext } from "@openmarko/kernel";
import { writeSetting } from "@openmarko/settings";

/** Writes an Organization setting in a namespace the test needs (autopilot, for example). */
export async function setSetting(ctx: AppContext, orgId: string, namespace: string, value: unknown): Promise<void> {
  await writeSetting(ctx.db, "organization", orgId, namespace, value);
}
