import type { Elysia } from "elysia";
import type { Pool } from "pg";
import type { Config } from "./config";
import type { Db } from "./db";
import type { Handler } from "./events";
import type { MasterKeys } from "./crypto";
import type { AdminGuard, OrgGuard } from "./guard";
import type { Catalog, Declared, DeclaredResource, DeclaredSetting } from "./catalog";
import type { Billing } from "./billing";
import type { Knowledge } from "./knowledge";
import type { FileStore } from "./files";

/** What every module can reach. Built once at boot by apps/api and apps/worker. */
export type AppContext = {
  cfg: Config;
  db: Db;
  /** The application's pool. Modules that need their own search_path (identity) make their own. */
  pool: Pool;
  masterKeys: MasterKeys;
  /** Files kept outside the database (`cfg.files`): null when the app has nowhere to put them, so nothing is kept. */
  files: FileStore | null;
  /**
   * Derives `caller` for routes inside an Organization (`/organizations/:orgId/...`).
   * Set by the composition root, which owns sessions. Modules use it with `.use(ctx.orgGuard)`, never import it.
   */
  orgGuard?: OrgGuard;
  /**
   * Derives `admin` (the signed-in app admin) for routes under `/api/v1/admin/...`. Set by the composition root.
   * Modules use it with `.use(ctx.adminGuard)`.
   */
  adminGuard?: AdminGuard;
  /** Plans, limits and metering. Set by the billing module at boot; absent, everything is allowed (`billingOf`). */
  billing?: Billing;
  /** Knowledge bases, for assistants. Set by the knowledge module at boot; absent, assistants answer without them. */
  knowledge?: Knowledge;
  /** What the composed modules offer (their manifests). Set by the composition root; read it with `catalogOf`. */
  catalog?: Catalog;
  /**
   * Queues an email, when the messaging module runs: sign-in emails from identity go through it.
   * Resolves `false` when the app can't send yet (no sender or no provider), so callers carry on without it.
   */
  email?: (msg: OutgoingEmail) => Promise<boolean>;
  /** Queues a job. Set by apps/api and apps/worker. Routes use it for work that runs later. */
  enqueue?: (name: string, data: Record<string, unknown>, opts?: EnqueueOptions) => Promise<void>;
};

/** An email the app sends: one of messaging's templates, with what it fills in. */
export type OutgoingEmail = {
  organizationId?: string | null;
  to: string;
  template: "verify-email" | "reset-password" | "magic-link" | "invitation" | "test";
  data: Record<string, string>;
};

/** For a job that's one Organization's work: at most JOBS_PER_ORGANIZATION of them run at once. */
export type EnqueueOptions = { organizationId?: string | null };

/** Background jobs one Organization runs at once per queue, across every worker (pg-boss group concurrency). */
export const JOBS_PER_ORGANIZATION = 5;

export type JobHelpers = {
  /** Queues another job by name. The worker runs it. */
  enqueue: (name: string, data: Record<string, unknown>, opts?: EnqueueOptions) => Promise<void>;
};

export type JobDefinition = {
  /** Unique job name, e.g. "knowledge.ingest". */
  name: string;
  /** Runs the job with the data it was queued with. */
  run: (data: Record<string, unknown>, helpers: JobHelpers) => Promise<void>;
  /** Cron expression (UTC) when the job runs on a clock. */
  cron?: string;
  /** How a failed run is retried, with exponential backoff. Default: pg-boss's (2 retries, no delay). */
  retry?: { limit: number; delaySeconds: number; maxDelaySeconds?: number };
  /** One Organization's work, queued with its organizationId: at most JOBS_PER_ORGANIZATION run at once per Organization. */
  perOrganization?: boolean;
};

export type ModuleParts = {
  /** Mounted by apps/api. */
  routes?: Elysia<any, any, any, any, any, any, any>;
  handlers?: { event: string; name: string; fn: Handler }[];
  jobs?: JobDefinition[];
};

/**
 * A module's manifest: what it is and what it offers, readable without booting it. The composition root gathers
 * manifests into the catalog; settings, Roles, the platform admin area and the API docs read from it, so adding a module
 * changes none of those by hand.
 */
export type ModuleDefinition = {
  id: string;
  /** The group this module's routes sit in, in the API docs at /openapi. */
  apiGroup: { name: string; description: string };
  /** Modules that must be enabled too. Boot fails if one is missing. */
  dependsOn?: string[];
  /** Events (`resource.what_happened`) this module emits. Handlers may only listen for declared events. */
  events?: Declared[];
  /** Settings namespaces this module owns, read and written through @app/settings. */
  settings?: DeclaredSetting[];
  /** Permission resources this module's routes check with `requireAllowed`, and their actions. */
  permissions?: DeclaredResource[];
  /** Role editor groups this module introduces. A resource may sit in any group in the catalog. */
  roleGroups?: Declared[];
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

/** The catalog of the composed modules. Fails loudly if the composition root didn't set it. */
export function catalogOf(ctx: AppContext): Catalog {
  if (!ctx.catalog) throw new Error("ctx.catalog is not set: compose() or the test kit sets it.");
  return ctx.catalog;
}

/** Whether a module is enabled in this process. For code that branches on an optional module (billing, say). */
export const moduleOn = (ctx: AppContext, id: string): boolean => ctx.cfg.enabledModules.includes(id as never);
