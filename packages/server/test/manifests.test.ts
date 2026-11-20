// Every module's manifest is valid, and the code only emits events its modules declare.
import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { allModules, coreModules, loadConfig } from "@app/kernel";
import { moduleCatalog, registry } from "../src";

const cfg = loadConfig({
  DATABASE_URL: "postgres://unused/unused",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  MASTER_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
});

/** Event names written in emit() calls: every quoted `resource.what_happened` in an `event:` property. */
async function emittedEvents(): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const repo = `${import.meta.dir}/../../..`;
  for (const pattern of ["modules/*/src/**/*.ts"])
    for await (const file of new Glob(pattern).scan({ cwd: repo, absolute: true })) {
      const text = await Bun.file(file).text();
      for (const call of text.matchAll(/emit\([^]{0,200}?event:([^\n]*)/g))
        for (const [, name] of call[1]!.matchAll(/"([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)"/g)) found.set(name!, file);
    }
  return found;
}

describe("module manifests", () => {
  test("the catalog of every module builds: ids well formed, none declared twice", () => {
    expect(Object.keys(registry).toSorted()).toEqual([...allModules].toSorted());
    const catalog = moduleCatalog(cfg);
    expect(catalog.modules.toSorted()).toEqual([...cfg.enabledModules].toSorted());
  });

  test("the core modules stand alone: every optional module can be off", async () => {
    // Throws if a core module's manifest depends on an optional one.
    expect(moduleCatalog({ ...cfg, enabledModules: [...coreModules] }).modules.toSorted()).toEqual([...coreModules].toSorted());
    const optional = allModules.filter((m) => !(coreModules as readonly string[]).includes(m));
    const imports = new RegExp(`from "@app/(${optional.join("|")})"`);
    const repo = `${import.meta.dir}/../../..`;
    const offenders: string[] = [];
    for (const core of coreModules)
      for await (const file of new Glob("src/**/*.ts").scan({ cwd: `${repo}/modules/${core}` }))
        if (imports.test(await Bun.file(`${repo}/modules/${core}/${file}`).text())) offenders.push(`${core}/${file}`);
    expect(offenders).toEqual([]);
  });

  test("every event the code emits is declared by a module", async () => {
    const declared = new Set(moduleCatalog(cfg).events.map((e) => e.id));
    const emitted = await emittedEvents();
    expect(emitted.size).toBeGreaterThan(5);
    const undeclared = [...emitted].filter(([name]) => !declared.has(name)).map(([name, file]) => `${name} (${file})`);
    expect(undeclared).toEqual([]);
  });
});
