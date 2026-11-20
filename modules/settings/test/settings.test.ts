// Settings come from module manifests and are checked on every write and read.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import { buildCatalog, defineModule, type Catalog } from "@app/kernel";
import { createTestDb, ownerSession, type Session, type TestDb } from "@app/testkit";
import { readAppSetting, readSetting, writeAppSetting, writeSetting } from "../src";

let t: TestDb;
let owner: Session;
let composed: Catalog;

// A module of the test's own, so the test doesn't depend on another module's settings.
const notes = defineModule({
  id: "notes",
  apiGroup: { name: "Notes", description: "Notes." },
  settings: [
    {
      id: "notes",
      label: "Note preferences",
      schema: z.object({ colour: z.enum(["red", "blue"]), size: z.number().int().default(12) }),
      scopes: ["organization", "app", "user"],
    },
  ],
  setup: () => ({}),
});

beforeAll(async () => {
  t = await createTestDb();
  composed = t.ctx.catalog!;
  owner = await ownerSession(t.ctx);
  t.ctx.catalog = buildCatalog([notes]);
});
afterAll(async () => {
  t.ctx.catalog = composed;
  await t.teardown();
});

describe("settings from manifests", () => {
  test("a write is checked against the declared schema; a read applies its defaults", async () => {
    await expect(writeSetting(t.ctx, "organization", owner.orgId, "notes", { colour: "green" })).rejects.toThrow("Invalid notes");
    expect(await writeSetting(t.ctx, "organization", owner.orgId, "notes", { colour: "red" })).toBe(1);
    expect(await readSetting(t.ctx, "organization", owner.orgId, "notes")).toEqual({ value: { colour: "red", size: 12 }, version: 1 });
  });

  test("a stale version is refused", async () => {
    expect(await writeSetting(t.ctx, "organization", owner.orgId, "notes", { colour: "blue" }, { expectedVersion: 1 })).toBe(2);
    await expect(writeSetting(t.ctx, "organization", owner.orgId, "notes", { colour: "red" }, { expectedVersion: 1 })).rejects.toThrow(
      "changed since",
    );
  });

  test("only declared namespaces, at declared scopes", async () => {
    await expect(readSetting(t.ctx, "organization", owner.orgId, "nope")).rejects.toThrow('No module declares the setting "nope"');
    await expect(writeSetting(t.ctx, "partner", owner.orgId, "notes", { colour: "red" })).rejects.toThrow("can't be set per partner");
  });

  test("app-wide settings live under the one app scope", async () => {
    expect(await readAppSetting(t.ctx, "notes")).toBeNull();
    await writeAppSetting(t.ctx, "notes", { colour: "red" });
    expect((await readAppSetting<{ colour: string }>(t.ctx, "notes"))?.value.colour).toBe("red");
    const { rows } = await t.ctx.pool.query(
      `select scope_type, scope_id from core.settings where namespace = 'notes' and scope_type = 'app'`,
    );
    expect(rows).toEqual([{ scope_type: "app", scope_id: "app" }]);
  });

  test("a stored value that no longer fits its schema reads as unset, and the next write replaces it", async () => {
    await writeSetting(t.ctx, "user", owner.userId, "notes", { colour: "blue" });
    await t.ctx.pool.query(`update core.settings set value = '{"colour":"purple"}' where scope_type = 'user' and scope_id = $1`, [
      owner.userId,
    ]);
    expect(await readSetting(t.ctx, "user", owner.userId, "notes")).toBeNull();
    expect(await writeSetting(t.ctx, "user", owner.userId, "notes", { colour: "red" })).toBe(2);
  });
});
