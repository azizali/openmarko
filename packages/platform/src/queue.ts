// The job queue (pg-boss, ADR 0007). The API sends jobs; only the worker runs them and keeps cron schedules.
import { PgBoss } from "pg-boss";
import type { JobHelpers } from "@openmarko/kernel";

export type QueueClient = {
  boss: PgBoss;
  enqueue: JobHelpers["enqueue"];
  stop: () => Promise<void>;
};

/**
 * Starts a queue client and makes sure every job's queue exists (pg-boss refuses to send to a queue that doesn't).
 * `runs` decides whether this process also supervises and schedules: true for the worker, false for the API.
 */
export async function startQueue(databaseUrl: string, jobNames: string[], opts: { runs: boolean }): Promise<QueueClient> {
  const boss = new PgBoss({ connectionString: databaseUrl, schedule: opts.runs, supervise: opts.runs });
  boss.on("error", (err) => console.error("pg-boss error", err));
  await boss.start();
  for (const name of new Set(jobNames)) await boss.createQueue(name);
  return {
    boss,
    enqueue: async (name, data) => {
      await boss.send(name, data);
    },
    stop: () => boss.stop({ graceful: true, timeout: 10_000 }),
  };
}
