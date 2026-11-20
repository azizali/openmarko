// What a new production database needs beyond its tables. Runs after migrations on every deploy
// (.kamal/hooks/pre-deploy), and changes nothing once it's been done.
import { createAppContext, loadConfig, moduleOn } from "@app/kernel";

const ctx = createAppContext(loadConfig());
try {
  if (moduleOn(ctx, "billing")) {
    const { ensureFirstPlan } = await import("@app/billing");
    console.log((await ensureFirstPlan(ctx)) ? "made the first Plan (Free)" : "Plans already exist");
  }
} finally {
  await ctx.pool.end();
}
