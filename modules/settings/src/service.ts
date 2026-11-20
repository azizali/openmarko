// Settings that aren't columns. Each module declares its namespaces in its manifest (`settings` in defineModule):
// the schema, and the scopes it can be set at. Reads and writes are checked against it.
import { and, eq } from "drizzle-orm";
import {
  APP_SCOPE_ID,
  catalogOf,
  conflict,
  invalid,
  type AppContext,
  type Db,
  type SettingEntry,
  type SettingScope,
  type Tx,
} from "@app/kernel";
import { settings } from "./schema";

export type Scope = SettingScope;

function declared(ctx: AppContext, namespace: string, scope: Scope): SettingEntry {
  const entry = catalogOf(ctx).settings.find((s) => s.id === namespace);
  if (!entry) throw new Error(`No module declares the setting "${namespace}".`);
  if (!entry.scopes.includes(scope))
    throw new Error(`The setting "${namespace}" can't be set per ${scope} (only ${entry.scopes.join(", ")}).`);
  return entry;
}

async function stored(db: Db | Tx, scope: Scope, scopeId: string, namespace: string) {
  const [row] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.scopeType, scope), eq(settings.scopeId, scopeId), eq(settings.namespace, namespace)));
  return row ?? null;
}

/**
 * A setting's value, parsed by its schema (so defaults for fields added later apply), and the version to name
 * when writing it back. A stored value that no longer fits the schema reads as unset; the next write replaces it.
 */
export async function readSetting<T = unknown>(
  ctx: AppContext,
  scope: Scope,
  scopeId: string,
  namespace: string,
  db: Db | Tx = ctx.db,
): Promise<{ value: T; version: number } | null> {
  const entry = declared(ctx, namespace, scope);
  const row = await stored(db, scope, scopeId, namespace);
  if (!row) return null;
  const parsed = entry.schema.safeParse(row.value);
  if (!parsed.success) {
    console.warn(`settings: stored ${namespace} for ${scope} ${scopeId} no longer fits its schema; reading it as unset`);
    return null;
  }
  return { value: parsed.data as T, version: row.version };
}

/** An app-wide setting (scope `app`). */
export const readAppSetting = <T = unknown>(ctx: AppContext, namespace: string) => readSetting<T>(ctx, "app", APP_SCOPE_ID, namespace);

/**
 * Writes a setting. With `expectedVersion`, the write fails if someone else changed it since it was read.
 * Without it, the write is last-one-wins (for settings nobody edits in two places at once).
 */
export async function writeSetting<T>(
  ctx: AppContext,
  scope: Scope,
  scopeId: string,
  namespace: string,
  value: T,
  opts: { expectedVersion?: number; by?: string | null; db?: Db | Tx } = {},
): Promise<number> {
  const entry = declared(ctx, namespace, scope);
  const db = opts.db ?? ctx.db;
  const parsed = entry.schema.safeParse(value);
  if (!parsed.success) throw invalid(`Invalid ${namespace} settings.`, { issues: parsed.error.issues });
  const current = await stored(db, scope, scopeId, namespace);
  if (!current) {
    await db.insert(settings).values({ scopeType: scope, scopeId, namespace, value: parsed.data, updatedBy: opts.by ?? null });
    return 1;
  }
  if (opts.expectedVersion !== undefined && opts.expectedVersion !== current.version) {
    throw conflict("These settings changed since you opened them. Reload and try again.", { version: current.version });
  }
  const next = current.version + 1;
  await db
    .update(settings)
    .set({ value: parsed.data, version: next, updatedBy: opts.by ?? null, updatedAt: new Date() })
    .where(and(eq(settings.scopeType, scope), eq(settings.scopeId, scopeId), eq(settings.namespace, namespace)));
  return next;
}

export const writeAppSetting = <T>(ctx: AppContext, namespace: string, value: T, opts?: { expectedVersion?: number; by?: string | null }) =>
  writeSetting(ctx, "app", APP_SCOPE_ID, namespace, value, opts);
