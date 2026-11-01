import type { Elysia } from "elysia";
import type { Pool } from "pg";
import type { Config } from "./config";
import type { Db } from "./db";
import type { Handler } from "./events";
import type { MasterKeys } from "./crypto";
import type { OrgGuard } from "./guard";

/** What every module can reach. Built once at boot by apps/api and apps/worker. */
export type AppContext = {
  cfg: Config;
  db: Db;
  /** The application's pool. Modules that need their own search_path (identity) make their own. */
  pool: Pool;
  masterKeys: MasterKeys;
  /**
   * Derives `caller` for routes inside an Organization (`/organizations/:orgId/...`).
   * Set by apps/api, which owns sessions. Modules use it with `.use(ctx.orgGuard)`, never import it.
   */
  orgGuard?: OrgGuard;
  /** Queues a job. Set by apps/api and apps/worker. Routes use it for work that runs later. */
  enqueue?: (name: string, data: Record<string, unknown>) => Promise<void>;
};

/**
 * A module is one folder under modules/<id>/. Its module.ts declares what it adds:
 * routes, event handlers and background jobs. `setup` runs once at boot with the shared context.
 */
export type JobHelpers = {
  /** Queues another job by name. The worker runs it. */
  enqueue: (name: string, data: Record<string, unknown>) => Promise<void>;
};

export type JobDefinition = {
  /** Unique job name, e.g. "seo.profile-sync". */
  name: string;
  /** Runs the job with the data it was queued with. */
  run: (data: Record<string, unknown>, helpers: JobHelpers) => Promise<void>;
  /** Cron expression (UTC) when the job runs on a clock. */
  cron?: string;
};

export type ModuleParts = {
  /** Mounted under /api/v1 by apps/api. */
  routes?: Elysia<any, any, any, any, any, any, any>;
  handlers?: { event: string; name: string; fn: Handler }[];
  jobs?: JobDefinition[];
};

export type ModuleDefinition = {
  id: string;
  /** Modules that must be enabled too. Boot fails if one is missing. */
  dependsOn?: string[];
  setup: (ctx: AppContext) => ModuleParts;
};

export function defineModule(m: ModuleDefinition): ModuleDefinition {
  return m;
}

/** Orders modules so dependencies come first, and rejects a missing or cyclic dependency. */
export function resolveModules(modules: ModuleDefinition[]): ModuleDefinition[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const out: ModuleDefinition[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string, path: string[]) => {
    const m = byId.get(id);
    if (!m) throw new Error(`module "${path[path.length - 1]}" depends on "${id}", which is not enabled`);
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") throw new Error(`module dependency cycle: ${[...path, id].join(" → ")}`);
    state.set(id, "visiting");
    for (const dep of m.dependsOn ?? []) visit(dep, [...path, id]);
    state.set(id, "done");
    out.push(m);
  };
  for (const m of modules) visit(m.id, []);
  return out;
}
