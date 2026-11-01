import { AppError, hmacHex } from "@openmarko/kernel";
import type { SiteInput, SiteSpec } from "../contract";

/**
 * Any CMS we don't have an adapter for: each change is POSTed to the customer's endpoint as JSON, signed with
 * HMAC-SHA256 of `<timestamp>.<body>` in `x-openmarko-signature` (`t=<unix>,v1=<hex>`), and their code applies it.
 * The endpoint answers with the contract's output for that op.
 */
export async function sendToEndpoint(endpoint: string, secret: string, input: SiteInput, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<unknown> {
  const body = JSON.stringify(input);
  const t = Math.floor(now / 1000);
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-openmarko-signature": `t=${t},v1=${hmacHex(secret, `${t}.${body}`)}` },
    body,
  });
  if (!res.ok) throw new AppError(502, "provider_error", `The site's endpoint returned ${res.status}`);
  return res.json();
}

const call = async (input: SiteInput, conn: { secrets: Record<string, string>; settings: Record<string, string> }) =>
  sendToEndpoint(conn.settings.endpoint!, conn.secrets.signingSecret!, input);

export const customSite: SiteSpec = {
  provider: "custom_site",
  supports: () => true,
  live: {
    publishArticle: async (i, c) => {
      const out = (await call(i, c)) as { externalId?: string; url?: string | null };
      if (!out.externalId) throw new AppError(502, "provider_error", "The site's endpoint didn't return an externalId.");
      return { externalId: String(out.externalId), url: out.url ?? null };
    },
    readPage: async (i, c) => {
      const out = (await call(i, c)) as { title?: string; metaDescription?: string | null };
      if (typeof out.title !== "string") throw new AppError(502, "provider_error", "The site's endpoint didn't return a title.");
      return { title: out.title, metaDescription: out.metaDescription ?? null };
    },
    setTitle: async (i, c) => {
      await call(i, c);
      return { ok: true };
    },
    setMetaDescription: async (i, c) => {
      await call(i, c);
      return { ok: true };
    },
  },
};
