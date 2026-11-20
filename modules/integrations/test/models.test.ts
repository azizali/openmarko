// Listing a vendor's models through its own API: each vendor's answer maps to one shape, and a live list is kept for
// a while per Connection so a page can ask freely.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, type TestDb } from "@app/testkit";
import { connect, listModels } from "../src";

let t: TestDb;
const realFetch = globalThis.fetch;
let calls = 0;

beforeAll(async () => {
  t = await createTestDb();
  for (const providerId of ["openai", "google_ai", "openrouter", "anthropic"] as const) {
    await connect(t.ctx, {
      organizationId: null,
      providerId,
      target: { type: "app", id: null },
      label: providerId,
      secrets: { apiKey: `key-${providerId}` },
      mode: providerId === "anthropic" ? "stub" : "live",
    });
  }
});
afterAll(() => t.teardown());
afterEach(() => {
  globalThis.fetch = realFetch;
  calls = 0;
});

const answer = (by: (url: string, init?: RequestInit) => unknown) => {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls++;
    const body = by(String(url), init);
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
};

describe("a vendor's models", () => {
  test("OpenAI: the key goes as a bearer token; chat, embedding and other models are told apart", async () => {
    answer((url, init) => {
      expect(url).toBe("https://api.openai.com/v1/models");
      expect((init!.headers as Record<string, string>).authorization).toBe("Bearer key-openai");
      return { data: [{ id: "whisper-1" }, { id: "text-embedding-3-small" }, { id: "gpt-5-mini" }, { id: "gpt-5-realtime" }] };
    });
    const models = await listModels(t.ctx, {}, "openai");
    expect(models.map((m) => [m.id, m.kind])).toEqual([
      ["openai/gpt-5-mini", "chat"],
      ["openai/text-embedding-3-small", "embedding"],
      ["openai/gpt-5-realtime", "other"],
      ["openai/whisper-1", "other"],
    ]);
  });

  test("Google: the method a model supports says what it is; its name loses the models/ prefix", async () => {
    answer((url, init) => {
      expect(url).toContain("generativelanguage.googleapis.com/v1beta/models");
      expect((init!.headers as Record<string, string>)["x-goog-api-key"]).toBe("key-google_ai");
      return {
        models: [
          {
            name: "models/gemini-3-flash",
            displayName: "Gemini 3 Flash",
            supportedGenerationMethods: ["generateContent"],
            inputTokenLimit: 1048576,
          },
          { name: "models/gemini-embedding-001", displayName: "Embedding", supportedGenerationMethods: ["embedContent"] },
        ],
      };
    });
    const models = await listModels(t.ctx, {}, "google");
    expect(models).toEqual([
      expect.objectContaining({ id: "google/gemini-3-flash", name: "Gemini 3 Flash", kind: "chat", contextLength: 1048576 }),
      expect.objectContaining({ id: "google/gemini-embedding-001", kind: "embedding" }),
    ]);
  });

  test("OpenRouter: prices per token become USD per million; the list is kept, and asked again only when told", async () => {
    answer(() => ({
      data: [
        {
          id: "anthropic/claude-haiku-5.5",
          name: "Claude Haiku 5.5",
          context_length: 1000000,
          pricing: { prompt: "0.0000001", completion: "0.0000005" },
        },
      ],
    }));
    const first = await listModels(t.ctx, {}, "openrouter");
    expect(first).toEqual([
      expect.objectContaining({
        id: "openrouter/anthropic/claude-haiku-5.5",
        pricing: { input: 0.1, output: 0.5 },
        contextLength: 1000000,
      }),
    ]);
    await listModels(t.ctx, {}, "openrouter");
    expect(calls).toBe(1);
    await listModels(t.ctx, {}, "openrouter", { fresh: true });
    expect(calls).toBe(2);
  });

  test("a refused key is a provider error that says so; a stub never calls out", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    await expect(listModels(t.ctx, {}, "google", { fresh: true })).rejects.toMatchObject({ code: "provider_error" });
    const stub = await listModels(t.ctx, {}, "anthropic");
    expect(stub.length).toBeGreaterThan(0);
    expect(stub[0]!.id.startsWith("anthropic/")).toBe(true);
  });
});
