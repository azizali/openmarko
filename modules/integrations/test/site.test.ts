import { afterEach, describe, expect, test } from "bun:test";
import { siteAdapters, siteOps, siteSpecs, sendToEndpoint, findPage, type SiteInput } from "../src/site";
import { hmacHex } from "@openmarko/kernel";
import type { CallContext } from "../src/adapters";

const inputs: Record<string, SiteInput> = {
  publishArticle: { op: "publishArticle", title: "Dental implants in Austin", body: "…" },
  readPage: { op: "readPage", url: "https://site.test/implants" },
  setTitle: { op: "setTitle", url: "https://site.test/implants", value: "Implants | Maple" },
  setMetaDescription: { op: "setMetaDescription", url: "https://site.test/implants", value: "Same-day implants." },
};

const callCtx = (mode: "stub" | "live", settings: Record<string, string> = {}, secrets: Record<string, string> = {}): CallContext => ({
  mode,
  provider: "wordpress",
  externalId: null,
  secrets: async () => secrets,
  settings,
  google: {},
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("every CMS honours the contract (ADR 0016)", () => {
  for (const adapter of siteAdapters) {
    test(`${adapter.provider}: each supported op returns the contract's shape (stub)`, async () => {
      const settings: Record<string, string> = adapter.provider === "wordpress" ? { seoPlugin: "yoast" } : {};
      for (const op of siteOps) {
        if (!adapter.site.supports(op, settings)) continue;
        const { output } = await adapter.call("site.write", inputs[op], callCtx("stub", settings));
        if (op === "publishArticle") expect(output).toMatchObject({ externalId: expect.any(String) });
        if (op === "readPage") expect(typeof (output as { title: string }).title).toBe("string");
        if (op === "setTitle" || op === "setMetaDescription") expect(output).toEqual({ ok: true });
      }
    });
  }

  test("a CMS has a spec for every Website provider in the catalog that serves site.write", async () => {
    const { providers } = await import("@openmarko/shared");
    const cmsIds = providers
      .filter((p) => p.capabilities.includes("site.write"))
      .map((p) => p.id)
      .toSorted();
    expect(siteSpecs.map((s) => s.provider).toSorted()).toEqual(cmsIds);
  });

  test("an op the connection's CMS can't do is refused with what and why, before any call", async () => {
    const wp = siteAdapters.find((a) => a.provider === "wordpress")!;
    const err = await wp.call("site.write", inputs.setMetaDescription!, callCtx("stub", { seoPlugin: "none" })).catch((e) => e);
    expect(err.status).toBe(409);
    expect(err.code).toBe("unsupported_by_cms");
    expect(err.details).toEqual({ op: "setMetaDescription", provider: "wordpress" });
  });

  test("a hosted CMS without its live calls yet says so (501), it doesn't pretend", async () => {
    const webflow = siteAdapters.find((a) => a.provider === "webflow")!;
    await expect(webflow.call("site.write", inputs.setTitle!, callCtx("live"))).rejects.toMatchObject({ status: 501 });
  });
});

function fakeSite(calls: { url: string; method: string; body?: string }[]) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body as string | undefined });
    if (String(url).includes("?slug="))
      return new Response(JSON.stringify([{ id: 7, title: { rendered: "Old" }, meta: { _yoast_wpseo_metadesc: "Old desc" } }]));
    if (String(url).endsWith("/posts")) return new Response(JSON.stringify({ id: 99, link: "https://site.test/new-post" }));
    return new Response("{}");
  }) as unknown as typeof fetch;
}

describe("WordPress live (mocked site)", () => {
  const settings = { siteUrl: "https://site.test", username: "u", seoPlugin: "yoast" };
  const secrets = { appPassword: "p" };

  test("finds a page by the last segment of its URL", async () => {
    let asked = "";
    const fake = (async (url: string) => {
      asked = url;
      return new Response(JSON.stringify([{ id: 42, title: { rendered: "Implants" } }]));
    }) as unknown as typeof fetch;
    const page = await findPage("https://site.test", "Basic x", "https://site.test/services/implants/", fake);
    expect(asked).toBe("https://site.test/wp-json/wp/v2/pages?slug=implants");
    expect(page.id).toBe(42);
  });

  test("setTitle updates the page it found", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    fakeSite(calls);
    const wp = siteAdapters.find((a) => a.provider === "wordpress")!;
    await wp.call("site.write", inputs.setTitle!, callCtx("live", settings, secrets));
    const update = calls.find((c) => c.method === "POST")!;
    expect(update.url).toBe("https://site.test/wp-json/wp/v2/pages/7");
    expect(JSON.parse(update.body!)).toEqual({ title: "Implants | Maple" });
  });

  test("setMetaDescription writes the SEO plugin's field, and readPage reads it back", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    fakeSite(calls);
    const wp = siteAdapters.find((a) => a.provider === "wordpress")!;
    const read = await wp.call("site.write", inputs.readPage!, callCtx("live", settings, secrets));
    expect(read.output).toEqual({ title: "Old", metaDescription: "Old desc" });
    await wp.call("site.write", inputs.setMetaDescription!, callCtx("live", settings, secrets));
    expect(JSON.parse(calls.find((c) => c.method === "POST")!.body!)).toEqual({ meta: { _yoast_wpseo_metadesc: "Same-day implants." } });
  });

  test("publishArticle returns the post's id and link", async () => {
    fakeSite([]);
    const wp = siteAdapters.find((a) => a.provider === "wordpress")!;
    const { output } = await wp.call("site.write", inputs.publishArticle!, callCtx("live", settings, secrets));
    expect(output).toEqual({ externalId: "99", url: "https://site.test/new-post" });
  });
});

describe("custom site (signed webhook to the customer's endpoint)", () => {
  test("each change is POSTed as JSON with a timestamped HMAC signature", async () => {
    let sent: { url: string; body: string; sig: string } | null = null;
    const fake = (async (url: string, init?: RequestInit) => {
      sent = { url: String(url), body: String(init?.body), sig: new Headers(init?.headers).get("x-openmarko-signature")! };
      return new Response(JSON.stringify({ ok: true }));
    }) as unknown as typeof fetch;
    await sendToEndpoint("https://site.test/hook", "s3cret-signing-key", inputs.setTitle!, fake, 1_700_000_000_000);
    expect(sent!.url).toBe("https://site.test/hook");
    expect(JSON.parse(sent!.body)).toEqual(inputs.setTitle);
    expect(sent!.sig).toBe(`t=1700000000,v1=${hmacHex("s3cret-signing-key", `1700000000.${sent!.body}`)}`);
  });

  test("an endpoint that answers without the contract's fields is an error, not a silent success", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({}))) as unknown as typeof fetch;
    const custom = siteAdapters.find((a) => a.provider === "custom_site")!;
    const ctx = callCtx("live", { endpoint: "https://site.test/hook" }, { signingSecret: "s3cret-signing-key" });
    await expect(custom.call("site.write", inputs.publishArticle!, ctx)).rejects.toMatchObject({ status: 502 });
  });
});
