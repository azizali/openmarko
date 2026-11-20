// The job queue (pg-boss, ADR 0007). The API sends jobs; only the worker runs them and keeps cron schedules.
import { PgBoss } from "pg-boss";
import type { JobDefinition, JobHelpers } from "@app/kernel";

/** A queue to create: a job's name, and how it retries. */
export type QueueSpec = string | Pick<JobDefinition, "name" | "retry">;

export type QueueClient = {
  boss: PgBoss;
  enqueue: JobHelpers["enqueue"];
  stop: () => Promise<void>;
};

/**
 * Starts a queue client and makes sure every job's queue exists (pg-boss refuses to send to a queue that doesn't).
 * `runs` decides whether this process also supervises and schedules: true for the worker, false for the API.
 */
export async function startQueue(databaseUrl: string, queues: QueueSpec[], opts: { runs: boolean }): Promise<QueueClient> {
  const boss = new PgBoss({ connectionString: databaseUrl, schedule: opts.runs, supervise: opts.runs });
  boss.on("error", (err) => console.error("pg-boss error", err));
  await boss.start();
  const specs = new Map(queues.map((q) => (typeof q === "string" ? [q, { name: q }] : [q.name, q])));
  for (const { name, retry } of specs.values()) {
    await boss.createQueue(name);
    // Applied on every start, so a job that gains or changes its retry rule gets it on an existing queue too.
    if (retry) {
      await boss.updateQueue(name, {
        retryLimit: retry.limit,
        retryDelay: retry.delaySeconds,
        retryBackoff: true,
        ...(retry.maxDelaySeconds ? { retryDelayMax: retry.maxDelaySeconds } : {}),
      });
    }
  }
  return {
    boss,
    enqueue: async (name, data, send) => {
      // An Organization's job carries it as its group, so the worker caps each Organization's running jobs.
      await boss.send(name, data, send?.organizationId ? { group: { id: send.organizationId } } : undefined);
    },
    stop: () => boss.stop({ graceful: true, timeout: 10_000 }),
  };
}
