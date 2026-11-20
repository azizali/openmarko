import type { AppContext } from "@app/kernel";
import { writeSetting } from "@app/settings";

/** Writes an Organization setting in a namespace the test needs (autopilot, for example). */
export async function setSetting(ctx: AppContext, orgId: string, namespace: string, value: unknown): Promise<void> {
  await writeSetting(ctx, "organization", orgId, namespace, value);
}
