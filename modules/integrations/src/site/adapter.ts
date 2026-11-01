import { AppError } from "@openmarko/kernel";
import type { Adapter } from "../adapters/types";
import type { InputOf, SiteInput, SiteOp, SiteOutput, SiteSpec } from "./contract";

/** The same stub for every CMS (ADR 0013): deterministic, shaped like the contract's outputs. */
export function stubSite<O extends SiteOp>(input: InputOf<O>): SiteOutput[O] {
  const i = input as SiteInput;
  switch (i.op) {
    case "publishArticle": {
      const slug = i.slug ?? i.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return { externalId: `stub-${slug}`, url: `https://stub.example/${slug}` } as SiteOutput[O];
    }
    case "readPage":
      return { title: "Old title", metaDescription: "Old description" } as SiteOutput[O];
    default:
      return { ok: true } as SiteOutput[O];
  }
}

/**
 * Builds the integrations Adapter for a CMS from its spec: checks the op is supported for this connection, then
 * runs the stub or the live call. Website changes are free (not metered).
 */
export function siteAdapter(spec: SiteSpec): Adapter & { site: SiteSpec } {
  return {
    provider: spec.provider,
    capabilities: ["site.write"],
    site: spec,
    call: async (_capability, input: SiteInput, { mode, secrets, settings }) => {
      if (!spec.supports(input.op, settings)) {
        throw new AppError(409, "unsupported_by_cms", `This website's CMS can't ${input.op} through the connection.`, { op: input.op, provider: spec.provider });
      }
      if (mode === "stub") return { output: stubSite(input), quantity: 1, costMicros: 0 };
      const live = spec.live[input.op] as ((i: SiteInput, c: { secrets: Record<string, string>; settings: Record<string, string> }) => Promise<unknown>) | undefined;
      if (!live) throw new AppError(501, "not_implemented", `${spec.provider} ${input.op} isn't built live yet.`);
      return { output: await live(input, { secrets: await secrets(), settings }), quantity: 1, costMicros: 0 };
    },
  };
}
