import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, requester, type TestDb } from "@openmarko/testkit";
import { compose, buildApi } from "@openmarko/platform";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.teardown());

describe("the API describes itself (OpenAPI at /openapi)", () => {
  test("the spec lists the organization and SEO routes", async () => {
    const app = buildApi(t.ctx, compose(t.ctx));
    const r = await requester(app)("GET", "/openapi/json");
    expect(r.status).toBe(200);
    const paths = Object.keys(r.body.paths);
    expect(paths.some((p) => p.includes("/api/v1/organizations/{orgId}/locations"))).toBe(true);
    expect(paths.some((p) => p.includes("/seo/locations/{locationId}/profile"))).toBe(true);
    expect(r.body.info.title).toBe("OpenMarko API");
  });
});

describe("the docs are grouped", () => {
  test("every operation sits in a named group, and every group is described", async () => {
    const { apiTags } = await import("@openmarko/platform");
    const app = buildApi(t.ctx, compose(t.ctx));
    const doc = (await requester(app)("GET", "/openapi/json")).body;
    const described = new Set((doc.tags as { name: string }[]).map((tg) => tg.name));
    for (const tag of apiTags) expect(described.has(tag.name)).toBe(true);
    const ops = Object.values(doc.paths as Record<string, Record<string, { tags?: string[] }>>).flatMap((m) => Object.values(m));
    expect(ops.length).toBeGreaterThan(0);
    for (const op of ops) {
      expect(op.tags?.length).toBeGreaterThan(0);
      expect(described.has(op.tags![0]!)).toBe(true);
    }
  });

  test("Better Auth's routes are left out of this spec (they document themselves)", async () => {
    const app = buildApi(t.ctx, compose(t.ctx));
    const doc = (await requester(app)("GET", "/openapi/json")).body;
    expect(Object.keys(doc.paths).some((p) => p.startsWith("/api/auth"))).toBe(false);
  });
});

describe("every operation has a title", () => {
  test("each operation has a summary, and titles are unique within their group", async () => {
    const app = buildApi(t.ctx, compose(t.ctx));
    const doc = (await requester(app)("GET", "/openapi/json")).body;
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
