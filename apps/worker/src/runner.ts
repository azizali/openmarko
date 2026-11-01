// Runs the job queue on pg-boss (queue tables live in the same Postgres, ADR 0007).
// Also drains the outbox on an interval, and keeps cron jobs scheduled.
import type { JobDefinition } from "@openmarko/kernel";
import type { QueueClient } from "@openmarko/platform";

export type WorkerOptions = {
  queue: QueueClient;
  jobs: JobDefinition[];
  drain: () => Promise<{ delivered: number; failed: number }>;
  /** How often the outbox is drained, in ms. */
  drainEveryMs?: number;
  /** Closes the process's own resources (pools) after the queue stops. */
  close: () => Promise<void>;
};

export async function runWorker(opts: WorkerOptions) {
  const { boss, enqueue } = opts.queue;
  for (const job of opts.jobs) {
    await boss.work(job.name, async ([j]) => {
      await job.run((j?.data ?? {}) as Record<string, unknown>, { enqueue });
    });
    if (job.cron) await boss.schedule(job.name, job.cron, {});
  }

  // One drain at a time: a slow drain must not overlap the next tick.
  let draining = false;
  const timer = setInterval(async () => {
    if (draining) return;
    draining = true;
    try {
      await opts.drain();
    } catch (err) {
      console.error("outbox drain failed", err);
    } finally {
      draining = false;
    }
  }, opts.drainEveryMs ?? 1000);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    await opts.queue.stop();
    await opts.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop());
  process.on("SIGINT", () => void stop());
  return { stop };
}
