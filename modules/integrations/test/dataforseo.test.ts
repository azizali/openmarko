import { describe, expect, test } from "bun:test";
import { dfsPost, toMicros } from "../src/adapters/dataforseo/client";
import { aiOptimization, backlinks, labs, onPage, serp } from "../src/adapters/dataforseo/apis";

const creds = { login: "api-login", password: "api-password" };

/** A DataForSEO-shaped response: the envelope, one task, and its result. */
const envelope = (result: unknown[], cost = 0.0006) => ({
  status_code: 20000,
  status_message: "Ok.",
  cost,
  tasks: [{ status_code: 20000, status_message: "Ok.", cost, result }],
});

function fakeDfs(body: unknown, status = 200) {
  const calls: { url: string; auth: string; body: unknown }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), auth: new Headers(init?.headers).get("authorization")!, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("the DataForSEO client (one for every API)", () => {
  test("posts one task with the API login and password as Basic auth", async () => {
    const { f, calls } = fakeDfs(envelope([{ items: [] }]));
    await dfsPost(creds, "serp/google/organic/live/advanced", { keyword: "dentist" }, f);
    expect(calls[0]!.url).toBe("https://api.dataforseo.com/v3/serp/google/organic/live/advanced");
    expect(calls[0]!.auth).toBe("Basic " + Buffer.from("api-login:api-password").toString("base64"));
    expect(calls[0]!.body).toEqual([{ keyword: "dentist" }]);
  });

  test("uses the cost DataForSEO reports, in micros", async () => {
    const { f } = fakeDfs(envelope([], 0.0123));
    expect((await dfsPost(creds, "x", {}, f)).costMicros).toBe(12300);
    expect(toMicros(undefined)).toBe(0);
  });

  test("an envelope error (bad credentials) is a provider error with its message", async () => {
    const { f } = fakeDfs({ status_code: 40100, status_message: "You are not authorized to access this resource." }, 401);
    await expect(dfsPost(creds, "x", {}, f)).rejects.toMatchObject({ status: 502, message: expect.stringContaining("not authorized") });
  });

  test("a task error inside an OK response is still an error", async () => {
    const { f } = fakeDfs({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [{ status_code: 40501, status_message: "Invalid Field: 'keyword'." }],
    });
    await expect(dfsPost(creds, "x", {}, f)).rejects.toMatchObject({ status: 502, message: expect.stringContaining("Invalid Field") });
  });

  test("missing credentials are refused before any request", async () => {
    await expect(dfsPost({ login: "", password: "" }, "x", {})).rejects.toMatchObject({ status: 503 });
  });
});

describe("each API maps DataForSEO's response to the capability's shape", () => {
  test("SERP organic: only organic results, rank and bare domain", async () => {
    const { f, calls } = fakeDfs(
      envelope([
        {
          items: [
            { type: "local_pack", rank_absolute: 1, domain: "maps.google.com", url: "x" },
            { type: "organic", rank_absolute: 2, domain: "www.mapleandmain.com", url: "https://www.mapleandmain.com/implants" },
          ],
        },
      ]),
    );
    const { output } = await serp.organic(creds, "dental implants", "30.25,-97.75,15z", f);
    expect(output).toEqual([{ rank: 2, domain: "mapleandmain.com", url: "https://www.mapleandmain.com/implants" }]);
    expect((calls[0]!.body as Record<string, unknown>[])[0]!.location_coordinate).toBe("30.25,-97.75,15z");
  });

  test("SERP maps: local pack rank and business name", async () => {
    const { f } = fakeDfs(envelope([{ items: [{ rank_group: 1, title: "Maple & Main Dental" }] }]));
    expect((await serp.maps(creds, "dentist", undefined, f)).output).toEqual([{ rank: 1, name: "Maple & Main Dental" }]);
  });

  test("Labs keyword ideas: term, volume and difficulty", async () => {
    const { f } = fakeDfs(
      envelope([
        {
          items: [
            { keyword: "dental implants cost", keyword_info: { search_volume: 1900 }, keyword_properties: { keyword_difficulty: 37 } },
          ],
        },
      ]),
    );
    expect((await labs.keywordIdeas(creds, "dental implants", f)).output).toEqual([{ term: "dental implants cost", volume: 1900, kd: 37 }]);
  });

  test("Backlinks referring domains", async () => {
    const { f } = fakeDfs(envelope([{ items: [{ domain: "austinchronicle.com", first_seen: "2026-09-01 00:00:00 +00:00" }] }]));
    expect((await backlinks.referringDomains(creds, "mapleandmain.com", f)).output).toEqual([
      { domain: "austinchronicle.com", url: "https://austinchronicle.com/", firstSeen: "2026-09-01 00:00:00 +00:00" },
    ]);
  });

  test("AI Optimization: the answer text, and which given names it mentions", async () => {
    const { f } = fakeDfs(envelope([{ markdown: "Try **Maple & Main Dental** or South Lamar Dental Studio." }]));
    const { output } = await aiOptimization.answer(
      creds,
      "chatgpt",
      "best dentist in Austin?",
      ["Maple & Main Dental", "Mueller Smiles"],
      f,
    );
    expect(output.listed).toEqual(["Maple & Main Dental"]);
  });

  test("an unknown AI engine is refused", async () => {
    await expect(aiOptimization.answer(creds, "bard", "q", [])).rejects.toMatchObject({ status: 422 });
  });

  test("On-Page crawls say they need the postback job, live", async () => {
    await expect(onPage.crawl()).rejects.toMatchObject({ status: 501 });
  });
});
