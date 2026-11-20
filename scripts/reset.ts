// Development only: drops and recreates the local database, migrates it and seeds it. The quickest way to a clean
// start: `bun run db:reset`. Refuses to run against anything but a local database.
import { loadMigrationConfig } from "@app/kernel";
import { Pool } from "pg";

if (process.env.NODE_ENV === "production") throw new Error("reset.ts is for development only.");
const { databaseUrl } = loadMigrationConfig();
const url = new URL(databaseUrl);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error(`reset.ts only resets a local database (got ${url.hostname}).`);
const name = url.pathname.slice(1);
url.pathname = "/postgres";

const admin = new Pool({ connectionString: url.toString(), max: 1 });
await admin.query(`drop database if exists "${name}" with (force)`);
await admin.query(`create database "${name}"`);
await admin.end();
console.log(`database ${name} recreated`);

await import("./migrate");
await import("./seed");
