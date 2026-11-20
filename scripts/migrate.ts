// Applies every migration, in order: Better Auth's tables (auth schema), then ours (Drizzle).
// Safe to run on every deploy: both steps only apply what's new. Needs only the database and auth settings.
import { createDb, loadMigrationConfig, migrateDrizzle } from "@app/kernel";
import { migrateAuth } from "@app/identity";

const cfg = loadMigrationConfig();
await migrateAuth({ ...cfg, adminEmails: [] });
const { pool, db } = createDb(cfg.databaseUrl, { max: 1 });
try {
  await migrateDrizzle(db);
  console.log("migrations applied");
} finally {
  await pool.end();
}
