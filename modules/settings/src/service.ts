import { and, eq } from "drizzle-orm";
import type { ZodType } from "zod";
import { conflict, invalid, type Db, type Tx } from "@openmarko/kernel";
import { settings } from "./schema";

export type Scope = "user" | "organization" | "partner" | "location" | "website" | "platform";

/** Each namespace registers its schema once; reads and writes are validated against it. */
const registry = new Map<string, ZodType>();
export function registerSetting(namespace: string, schema: ZodType): void {
  registry.set(namespace, schema);
}

function schemaFor(namespace: string): ZodType {
  const s = registry.get(namespace);
  if (!s) throw new Error(`setting namespace ${namespace} is not registered`);
  return s;
}

export async function readSetting<T = unknown>(
  db: Db | Tx,
  scope: Scope,
  scopeId: string,
  namespace: string,
): Promise<{ value: T; version: number } | null> {
  const [row] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.scopeType, scope), eq(settings.scopeId, scopeId), eq(settings.namespace, namespace)));
  if (!row) return null;
  return { value: row.value as T, version: row.version };
}

/**
 * Writes a setting. With `expectedVersion`, the write fails if someone else changed it since it was read.
 * Without it, the write is last-one-wins (for settings nobody edits in two places at once).
 */
export async function writeSetting<T>(
  db: Db | Tx,
  scope: Scope,
  scopeId: string,
  namespace: string,
  value: T,
  opts: { expectedVersion?: number; by?: string | null } = {},
): Promise<number> {
  const parsed = schemaFor(namespace).safeParse(value);
  if (!parsed.success) throw invalid(`Invalid ${namespace} settings.`, { issues: parsed.error.issues });
  const current = await readSetting(db, scope, scopeId, namespace);
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
