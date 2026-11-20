import { loadConfig, type Config } from "./config";
import { createDb } from "./db";
import { masterKeysFrom } from "./crypto";
import type { AppContext } from "./module";

export function createAppContext(cfg: Config = loadConfig()): AppContext {
  // The API's and worker's queries stop after 30 s (a runaway query must not hold a connection).
  const { pool, db } = createDb(cfg.databaseUrl, { statementTimeoutMs: 30_000 });
  return { cfg, db, pool, masterKeys: masterKeysFrom(cfg) };
}
