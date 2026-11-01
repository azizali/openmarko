import { createAppContext, loadConfig } from "@openmarko/kernel";
import { closeAuth } from "@openmarko/identity";
import { buildApi, compose, jobNames, startQueue } from "@openmarko/platform";

const cfg = loadConfig();
const ctx = createAppContext(cfg);
const composed = compose(ctx);
// The API only sends jobs (syncs, scans, audits); the worker runs them.
const queue = await startQueue(cfg.databaseUrl, jobNames(composed), { runs: false });
ctx.enqueue = queue.enqueue;

const app = buildApi(ctx, composed).listen(cfg.port);
console.log(`api listening on :${app.server?.port} with modules: ${composed.modules.map((m) => m.id).join(", ")}`);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`api: ${signal}, finishing in-flight requests`);
  await app.stop();
  await queue.stop();
  await closeAuth(ctx);
  await ctx.pool.end();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
