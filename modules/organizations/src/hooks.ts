// Cleanup that must run before an Organization is hard-deleted: revoking provider tokens, cancelling
// subscriptions. Its credentials are removed by the cascade, so these run first. Each hook must be idempotent.
import type { AppContext } from "@openmarko/kernel";

export type DeleteHook = { name: string; run: (ctx: AppContext, orgId: string) => Promise<void> };
const hooks: DeleteHook[] = [];

export function onOrganizationDelete(hook: DeleteHook): void {
  const i = hooks.findIndex((h) => h.name === hook.name);
  if (i >= 0) hooks[i] = hook;
  else hooks.push(hook);
}

export async function runDeleteHooks(ctx: AppContext, orgId: string): Promise<void> {
  for (const h of hooks) await h.run(ctx, orgId);
}
