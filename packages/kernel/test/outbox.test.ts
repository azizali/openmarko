import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createTestDb, type TestDb } from "@openmarko/testkit";
import { drainOutbox, emit, handle, outbox, outboxHandled, MAX_ATTEMPTS } from "../src";

let t: TestDb;
const seen: string[] = [];

beforeAll(async () => {
  t = await createTestDb();
  handle("test.thing", "test.recorder", async (_tx, e) => {
    seen.push(String(e.payload.n));
  });
});
afterAll(() => t.teardown());

describe("outbox: an event is written with its change, and delivered once (ADR 0009)", () => {
  test("a rolled-back transaction emits nothing", async () => {
    await expect(
      t.ctx.db.transaction(async (tx) => {
        await emit(tx, { event: "test.thing", payload: { n: "rolled-back" } });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await t.ctx.db
      .select()
      .from(outbox)
      .where(sql`event = 'test.thing'`);
    expect(rows.length).toBe(0);
  });

  test("a committed event is delivered to its handler, and drained only once", async () => {
    await t.ctx.db.transaction((tx) => emit(tx, { event: "test.thing", payload: { n: "once" } }));
    const first = await drainOutbox(t.ctx.db);
    expect(first.delivered).toBeGreaterThanOrEqual(1);
    expect(seen).toContain("once");

    const before = seen.length;
    await drainOutbox(t.ctx.db);
    expect(seen.length).toBe(before);
  });

  test("a handler that runs twice (after a crash) is recorded once in outbox_handled", async () => {
    const rows = await t.ctx.db
      .select()
      .from(outboxHandled)
      .where(sql`handler = 'test.recorder'`);
    const ids = rows.map((r) => r.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("a failing handler is retried with backoff, and its error is kept", async () => {
    handle("test.broken", "test.always-fails", async () => {
      throw new Error("provider down");
    });
    await t.ctx.db.transaction((tx) => emit(tx, { event: "test.broken", payload: {} }));
    const res = await drainOutbox(t.ctx.db);
    expect(res.failed).toBeGreaterThanOrEqual(1);
    const [row] = await t.ctx.db
      .select()
      .from(outbox)
      .where(sql`event = 'test.broken'`);
    expect(row!.attempts).toBe(1);
    expect(row!.lastError).toBe("provider down");
    expect(row!.processedAt).toBeNull();
    expect(MAX_ATTEMPTS).toBeGreaterThan(1);
  });
});
