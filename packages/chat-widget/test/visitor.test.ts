// A visitor's past chats: kept in their browser, each with its token, gone when the token expires.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ChatExpired, type ChatBackend } from "../src/chat";
import { visitorBackend } from "../src/visitor";

const realFetch = globalThis.fetch;
const realStorage = globalThis.localStorage;
const HOUR = 3600_000;
let store: Map<string, string>;
let backend: ChatBackend;
let expiresAt: number;
let next: number;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  store = new Map();
  expiresAt = Date.now() + HOUR;
  next = 0;
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as unknown as Storage;
  globalThis.fetch = (async () => json({ conversationId: `c${++next}`, token: `t${next}`, expiresAt })) as unknown as typeof fetch;
  backend = visitorBackend({ api: "https://api.test", assistant: "a1", visitorCheck: async () => undefined });
});
afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.localStorage = realStorage;
});

describe("a visitor's past chats", () => {
  test("are listed newest first, titled by the first message", async () => {
    await backend.start("Do you open on Sundays?");
    await backend.start("How much is a cleaning?");
    expect(await backend.list()).toEqual([
      { id: "c2", title: "How much is a cleaning?" },
      { id: "c1", title: "Do you open on Sundays?" },
    ]);
  });

  test("survive a page load", async () => {
    await backend.start("Hello");
    const afterReload = visitorBackend({ api: "https://api.test", assistant: "a1", visitorCheck: async () => undefined });
    expect((await afterReload.list()).map((c) => c.id)).toEqual(["c1"]);
  });

  test("are separate per assistant", async () => {
    await backend.start("Hello");
    const other = visitorBackend({ api: "https://api.test", assistant: "a2", visitorCheck: async () => undefined });
    expect(await other.list()).toEqual([]);
  });

  test("drop off when their token expires", async () => {
    expiresAt = Date.now() - 1;
    await backend.start("Hello");
    expect(await backend.list()).toEqual([]);
  });

  test("can be removed from this browser", async () => {
    const id = await backend.start("Hello");
    await backend.remove(id);
    expect(await backend.list()).toEqual([]);
  });

  test("still work for the page when the browser refuses storage", async () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;
    await backend.start("Hello");
    expect((await backend.list()).map((c) => c.id)).toEqual(["c1"]);
  });

  test("a refused token ends the chat", async () => {
    const id = await backend.start("Hello");
    globalThis.fetch = (async () => json({ message: "no" }, 401)) as unknown as typeof fetch;
    const reply = { onText: () => {}, onSources: () => {} };
    await expect(backend.send(id, "Again", reply, new AbortController().signal)).rejects.toBeInstanceOf(ChatExpired);
    expect(await backend.list()).toEqual([]);
  });
});
