import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Db } from "./db";

/** Drizzle migrations for every module's tables, generated into packages/kernel/drizzle. */
export const drizzleMigrationsFolder = new URL("../drizzle", import.meta.url).pathname;

/** Applies the Drizzle migrations. Better Auth's tables are migrated separately, first (see modules/identity). */
export async function migrateDrizzle(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: drizzleMigrationsFolder });
}
