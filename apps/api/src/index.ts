import { createAppContext, loadConfig } from "@app/kernel";
import { closeAuth, ensureAdmins } from "@app/identity";
import { buildApi, compose, jobQueues, startQueue } from "@app/server";

const cfg = loadConfig();
const ctx = createAppContext(cfg);
const composed = compose(ctx);
// The API only sends jobs (emails, ingesting); the worker runs them.
const queue = await startQueue(cfg.databaseUrl, jobQueues(composed), { runs: false });
ctx.enqueue = queue.enqueue;
await ensureAdmins(ctx);

// reusePort off: a second server on the same port must fail, not silently share the traffic (Elysia turns it on).
// idleTimeout: Bun closes a connection after 10 s without bytes, which would cut off a model that's slow to start
// answering. 120 s covers it; streams send as soon as there's text.
const app = buildApi(ctx, composed).listen({ port: cfg.port, reusePort: false, idleTimeout: 120 });
console.log(`api listening on :${app.server?.port} with modules: ${composed.modules.map((m) => m.id).join(", ")}`);
console.log(`api docs at http://localhost:${app.server?.port}/openapi`);

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
