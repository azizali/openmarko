import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, requester, type TestDb } from "@app/testkit";
import { compose, buildApi, apiTags } from "@app/server";
import { appConfig } from "@app/kernel";

let t: TestDb;
let doc: any;
beforeAll(async () => {
  t = await createTestDb();
  const app = buildApi(t.ctx, compose(t.ctx));
  const r = await requester(app)("GET", "/openapi/json");
  expect(r.status).toBe(200);
  doc = r.body;
});
afterAll(() => t.teardown());

describe("the API describes itself (OpenAPI at /openapi)", () => {
  test("the spec lists the organization and admin routes, under the app's name", () => {
    const paths = Object.keys(doc.paths);
    expect(paths).toContain("/api/v1/organizations/{orgId}/members");
    expect(paths.some((p) => p.startsWith("/api/v1/admin/users"))).toBe(true);
    expect(doc.info.title).toBe(`${appConfig.name} API`);
  });

  test("every operation sits in a named group, and every group is described", () => {
    const described = new Set((doc.tags as { name: string }[]).map((tg) => tg.name));
    for (const tag of doc.tags as { name: string }[]) expect(apiTags.some((a) => a.name === tag.name)).toBe(true);
    const ops = Object.values(doc.paths as Record<string, Record<string, { tags?: string[] }>>).flatMap((m) => Object.values(m));
    expect(ops.length).toBeGreaterThan(0);
    for (const op of ops) {
      expect(op.tags?.length).toBeGreaterThan(0);
      expect(described.has(op.tags![0]!)).toBe(true);
    }
  });

  test("Better Auth's routes are left out of this spec (they document themselves)", () => {
    expect(Object.keys(doc.paths).some((p) => p.startsWith("/api/auth"))).toBe(false);
  });

  test("each operation has a summary, and titles are unique within their group", () => {
    const seen = new Map<string, string[]>();
    for (const [path, methods] of Object.entries(doc.paths as Record<string, Record<string, { tags?: string[]; summary?: string }>>)) {
      for (const [method, op] of Object.entries(methods)) {
        expect(op.summary, `${method.toUpperCase()} ${path} has no summary`).toBeTruthy();
        const group = op.tags?.[0] ?? "";
        const list = seen.get(`${group}|${op.summary}`) ?? [];
        list.push(`${method.toUpperCase()} ${path}`);
        seen.set(`${group}|${op.summary}`, list);
      }
    }
    const dupes = [...seen.entries()].filter(([, v]) => v.length > 1);
    expect(dupes.map(([k, v]) => `${k} → ${v.join(", ")}`)).toEqual([]);
  });
});
