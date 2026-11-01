import { AppError } from "@openmarko/kernel";
import type { SiteSpec } from "../contract";

/** Where each SEO plugin keeps the meta description (it must be exposed to the REST API, which both plugins do). */
const metaField: Record<string, string> = { yoast: "_yoast_wpseo_metadesc", rankmath: "rank_math_description" };

const base = (settings: Record<string, string>) => (settings.siteUrl ?? "").replace(/\/$/, "");
const auth = (secrets: Record<string, string>, settings: Record<string, string>) =>
  "Basic " + Buffer.from(`${settings.username}:${secrets.appPassword}`).toString("base64");

/** The page a URL points at, by its last path segment (the slug). */
export async function findPage(
  siteUrl: string,
  authHeader: string,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: number; title: string; meta: Record<string, string> }> {
  const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
  const slug = path.split("/").pop() ?? "";
  const res = await fetchImpl(`${siteUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`, { headers: { authorization: authHeader } });
  if (!res.ok) throw new AppError(502, "provider_error", `WordPress returned ${res.status}`);
  const pages = (await res.json()) as { id: number; title: { rendered: string }; meta?: Record<string, string> }[];
  const page = pages[0];
  if (!page) throw new AppError(404, "not_found", `No WordPress page for ${url}.`);
  return { id: page.id, title: page.title.rendered, meta: page.meta ?? {} };
}

async function updatePage(siteUrl: string, authHeader: string, id: number, body: Record<string, unknown>) {
  const res = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${id}`, {
    method: "POST",
    headers: { authorization: authHeader, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new AppError(502, "provider_error", `WordPress returned ${res.status}`);
}

export const wordpressSite: SiteSpec = {
  provider: "wordpress",
  // Meta descriptions are stored by an SEO plugin; without one named on the connection there's nowhere to write.
  supports: (op, settings) => op !== "setMetaDescription" || (settings.seoPlugin ?? "") in metaField,
  live: {
    publishArticle: async (input, { secrets, settings }) => {
      const res = await fetch(`${base(settings)}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: { authorization: auth(secrets, settings), "content-type": "application/json" },
        body: JSON.stringify({ title: input.title, content: input.body, status: "publish", ...(input.slug ? { slug: input.slug } : {}) }),
      });
      if (!res.ok) throw new AppError(502, "provider_error", `WordPress returned ${res.status}`);
      const json = (await res.json()) as { id: number; link?: string };
      return { externalId: String(json.id), url: json.link ?? null };
    },
    readPage: async (input, { secrets, settings }) => {
      const page = await findPage(base(settings), auth(secrets, settings), input.url);
      const field = metaField[settings.seoPlugin ?? ""];
      return { title: page.title, metaDescription: field ? (page.meta[field] ?? null) : null };
    },
    setTitle: async (input, { secrets, settings }) => {
      const a = auth(secrets, settings);
      const page = await findPage(base(settings), a, input.url);
      await updatePage(base(settings), a, page.id, { title: input.value });
      return { ok: true };
    },
    setMetaDescription: async (input, { secrets, settings }) => {
      const a = auth(secrets, settings);
      const page = await findPage(base(settings), a, input.url);
      await updatePage(base(settings), a, page.id, { meta: { [metaField[settings.seoPlugin!]!]: input.value } });
      return { ok: true };
    },
  },
};
