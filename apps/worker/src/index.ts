import { createAppContext, drainOutbox, loadConfig } from "@app/kernel";
import { closeAuth, ensureAdmins } from "@app/identity";
import { compose, jobQueues, startQueue, workerContext } from "@app/server";
import { runWorker } from "./runner";

const cfg = loadConfig();
const ctx = workerContext(createAppContext(cfg));
const composed = compose(ctx);
const jobs = composed.parts.flatMap((p) => p.jobs ?? []);
const queue = await startQueue(cfg.databaseUrl, jobQueues(composed), { runs: true });
// Event handlers and jobs queue follow-up work through the same client.
ctx.enqueue = queue.enqueue;
await ensureAdmins(ctx);

await runWorker({
  queue,
  jobs,
  drain: () => drainOutbox(ctx.db),
  close: async () => {
    await closeAuth(ctx);
    await ctx.pool.end();
  },
});
console.log(`worker running ${jobs.length} job(s): ${jobs.map((j) => j.name).join(", ")}`);
