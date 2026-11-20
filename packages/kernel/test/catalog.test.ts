// The catalog gathers module manifests and refuses bad ones at boot.
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { buildCatalog, defineModule, describeCatalog } from "../src";

const mod = (id: string, extra: Partial<Parameters<typeof defineModule>[0]> = {}) =>
  defineModule({ id, apiGroup: { name: id, description: id }, setup: () => ({}), ...extra });

const buildBad = () =>
  buildCatalog([
    mod("a", { events: [{ id: "Thing.created", label: "" }] }),
    mod("b", { events: [{ id: "x.y", label: "" }] }),
    mod("c", { events: [{ id: "x.y", label: "" }] }),
  ]);

describe("buildCatalog", () => {
  test("gathers each module's events, noting which module declared them", () => {
    const c = buildCatalog([
      mod("a", { events: [{ id: "thing.created", label: "A thing" }] }),
      mod("b", { events: [{ id: "widget.moved", label: "A widget moved" }] }),
    ]);
    expect(c.modules).toEqual(["a", "b"]);
    expect(c.events.map((e) => `${e.module}/${e.id}`)).toEqual(["a/thing.created", "b/widget.moved"]);
  });

  test("settings are gathered with their schema and must name a scope", () => {
    const schema = z.object({ on: z.boolean() });
    const c = buildCatalog([mod("a", { settings: [{ id: "prefs", label: "Prefs", schema, scopes: ["organization"] }] })]);
    expect(c.settings[0]).toMatchObject({ id: "prefs", module: "a", scopes: ["organization"] });
    expect(describeCatalog(c).settings[0]!.schema).toMatchObject({ type: "object", properties: { on: { type: "boolean" } } });
    expect(() => buildCatalog([mod("a", { settings: [{ id: "prefs", label: "", schema, scopes: [] }] })])).toThrow("names no scope");
  });

  test("refuses malformed ids and the same id from two modules, naming every problem", () => {
    expect(buildBad).toThrow(/a: events "Thing.created"[\s\S]*declared by both b and c/);
  });
});

const groups = [{ id: "organization", label: "Organization" }];
const reviews = { id: "reviews", label: "Reviews", group: "organization", actions: [{ id: "view", label: "Read", tier: "view" as const }] };
const bad = () =>
  buildCatalog([
    mod("a", {
      roleGroups: groups,
      permissions: [
        { ...reviews, group: "nowhere" },
        { id: "empty", label: "", group: "organization", actions: [] },
        { id: "twice", label: "", group: "organization", actions: [reviews.actions[0]!, reviews.actions[0]!] },
        { id: "odd", label: "", group: "organization", actions: [{ id: "go", label: "", tier: "admin" as never }] },
      ],
    }),
    mod("b", { permissions: [reviews] }),
  ]);

describe("permission resources", () => {
  test("are gathered with their module and group", () => {
    const c = buildCatalog([
      mod("core", { roleGroups: groups }),
      mod("ai", { permissions: [reviews], roleGroups: [{ id: "ai", label: "AI" }] }),
    ]);
    expect(c.resources).toEqual([{ ...reviews, module: "ai" }]);
    expect(c.groups.map((g) => g.id)).toEqual(["organization", "ai"]);
  });

  test("refuses an undeclared group, a resource with no actions, a repeated action, a bad tier, and a resource two modules claim", () => {
    expect(bad).toThrow('resource "reviews" is in group "nowhere"');
    expect(bad).toThrow('resource "empty" has no actions');
    expect(bad).toThrow('action "twice.view" is declared twice');
    expect(bad).toThrow('action "odd.go" has an unknown tier "admin"');
    expect(bad).toThrow('permissions "reviews" is declared by both a and b');
  });
});
