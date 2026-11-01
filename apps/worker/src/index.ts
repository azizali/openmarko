import { createAppContext, drainOutbox, loadConfig } from "@openmarko/kernel";
import { closeAuth } from "@openmarko/identity";
import { compose, jobNames, startQueue, workerContext } from "@openmarko/platform";
import { runWorker } from "./runner";

const cfg = loadConfig();
const ctx = workerContext(createAppContext(cfg));
const composed = compose(ctx);
const jobs = composed.parts.flatMap((p) => p.jobs ?? []);
const queue = await startQueue(cfg.databaseUrl, jobNames(composed), { runs: true });
// Event handlers and jobs queue follow-up work through the same client (e.g. a reply draft for a low review).
ctx.enqueue = queue.enqueue;

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
