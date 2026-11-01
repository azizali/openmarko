import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Db = NodePgDatabase;
/** A transaction handle. Modules write their rows and emit events with it, so both commit or neither does. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createDb(url: string, opts: { max?: number } = {}) {
  const pool = new Pool({ connectionString: url, max: opts.max ?? 10 });
  const db = drizzle(pool);
  return { pool, db };
}
