// The CMS contract (ADR 0016). Features change a website only through these operations, never through a CMS's
// own API, so any CMS that implements them works: WordPress, Webflow, Shopify, Ghost, or a custom site by webhook.
import type { ProviderId } from "@openmarko/shared";

export type SiteInput =
  | { op: "publishArticle"; title: string; body: string; slug?: string }
  | { op: "readPage"; url: string }
  | { op: "setTitle"; url: string; value: string }
  | { op: "setMetaDescription"; url: string; value: string };

export type SiteOp = SiteInput["op"];
export const siteOps: SiteOp[] = ["publishArticle", "readPage", "setTitle", "setMetaDescription"];

export type SiteOutput = {
  publishArticle: { externalId: string; url: string | null };
  readPage: { title: string; metaDescription: string | null };
  setTitle: { ok: true };
  setMetaDescription: { ok: true };
};

export type InputOf<O extends SiteOp> = Extract<SiteInput, { op: O }>;

/** What a live call gets: the connection's secrets and its non-secret settings (from the provider's fields). */
export type SiteConnection = { secrets: Record<string, string>; settings: Record<string, string> };

/**
 * One CMS. `supports` may depend on the connection's settings (WordPress edits meta descriptions only through an
 * SEO plugin). `live` holds the real calls; an op it doesn't list is not built live yet.
 */
export type SiteSpec = {
  provider: ProviderId;
  supports: (op: SiteOp, settings: Record<string, string>) => boolean;
  live: { [O in SiteOp]?: (input: InputOf<O>, conn: SiteConnection) => Promise<SiteOutput[O]> };
};
