import { loadConfig, type Config } from "./config";
import { createDb } from "./db";
import { masterKeysFrom } from "./crypto";
import type { AppContext } from "./module";

export function createAppContext(cfg: Config = loadConfig()): AppContext {
  const { pool, db } = createDb(cfg.databaseUrl);
  return { cfg, db, pool, masterKeys: masterKeysFrom(cfg) };
}
