// Keeping a provider's untrimmed responses (ADR 0035): a live DataForSEO call hands over each task that came back
// with results, invoke() writes it to the file store and records it, it reads back whole, and pruning drops it later.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type Session, type TestDb } from "@app/testkit";
import { memoryStore } from "@app/kernel";
import { sql } from "drizzle-orm";
import { connect, integrationsSchema, invoke, pruneOriginals, readOriginal, type CollectOutput, type OrganicQuery } from "../src";

let t: TestDb;
let owner: Session;
const store = memoryStore();

beforeAll(async () => {
  t = await createTestDb();
  t.ctx.files = store;
  owner = await ownerSession(t.ctx);
  await connect(t.ctx, {
    organizationId: null,
    providerId: "dataforseo",
    target: { type: "app", id: null },
    label: "DataForSEO",
    settings: { login: "me@app.test" },
    secrets: { password: "x" },
    mode: "live",
  });
});
afterAll(() => t.teardown());

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const query: OrganicQuery = { keyword: "dentist austin", at: { lat: 30.25, lng: -97.75 }, languageCode: "en", depth: 100 };
// More than we read: a featured snippet and an ad sit beside the organic results.
const task = {
  id: "t-organic-1",
  status_code: 20000,
  status_message: "Ok.",
  cost: 0,
  result: [
    {
      items: [
        { type: "featured_snippet", title: "How much is a cleaning?", domain: "example.org" },
        { type: "paid", title: "Smiles R Us", domain: "ads.example" },
        { type: "organic", rank_group: 1, domain: "maple.example", url: "https://maple.example/", title: "Maple & Main Dental" },
      ],
    },
  ],
};

describe("keeping provider responses", () => {
  test("a live call keeps each task with results whole, and it reads back as it came", async () => {
    globalThis.fetch = (async () => Response.json({ status_code: 20000, status_message: "Ok.", tasks: [task] })) as unknown as typeof fetch;
    const out = await invoke<CollectOutput<unknown>>(t.ctx, owner.orgId, "search.organic", {
      op: "collect",
      tasks: [{ externalId: "serp/google/organic|t-organic-1", query }],
    });
    expect(out.output.collected[0]!.status).toBe("ready");

    const rows = await t.ctx.db.select().from(integrationsSchema.providerOriginals);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      providerId: "dataforseo",
      capability: "search.organic",
      ref: "t-organic-1",
      organizationId: owner.orgId,
    });
    expect(rows[0]!.fileKey).toMatch(/^originals\/dataforseo\/\d{4}-\d{2}-\d{2}\/.+\.json\.gz$/);
    expect(store.files.has(rows[0]!.fileKey)).toBe(true);
    expect(await readOriginal(t.ctx, "dataforseo", "t-organic-1")).toEqual(task);
  });

  test("with no file store nothing is kept, and the call still works", async () => {
    globalThis.fetch = (async () =>
      Response.json({ status_code: 20000, status_message: "Ok.", tasks: [{ ...task, id: "t-organic-2" }] })) as unknown as typeof fetch;
    t.ctx.files = null;
    try {
      const out = await invoke<CollectOutput<unknown>>(t.ctx, owner.orgId, "search.organic", {
        op: "collect",
        tasks: [{ externalId: "serp/google/organic|t-organic-2", query }],
      });
      expect(out.output.collected[0]!.status).toBe("ready");
    } finally {
      t.ctx.files = store;
    }
    expect(await readOriginal(t.ctx, "dataforseo", "t-organic-2")).toBeNull();
  });

  test("pruning drops what's older than PROVIDER_ORIGINALS_DAYS, file and row", async () => {
    const [row] = await t.ctx.db.select().from(integrationsSchema.providerOriginals);
    await t.ctx.db.execute(sql`update integrations.provider_originals set created_at = now() - interval '401 days'`);
    expect(await pruneOriginals(t.ctx)).toBe(1);
    expect(store.files.has(row!.fileKey)).toBe(false);
    expect(await t.ctx.db.select().from(integrationsSchema.providerOriginals)).toHaveLength(0);
  });
});
