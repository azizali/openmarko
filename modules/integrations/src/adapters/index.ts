import type { Adapter } from "./types";
import { dataforseo } from "./dataforseo";
import { llm } from "./llm";
import { gbp } from "./gbp";
import { emailAdapters } from "./email";
import { siteAdapters } from "../site/registry";
import type { ProviderId } from "@openmarko/shared";

/** Every adapter we have, by provider. Adding a provider = one adapter here plus a catalog entry. */
const all: Adapter[] = [
  dataforseo,
  gbp,
  ...siteAdapters,
  ...emailAdapters,
  { ...llm, provider: "anthropic" },
  { ...llm, provider: "openai" },
  { ...llm, provider: "google_ai" },
  { ...llm, provider: "openrouter" },
  { ...llm, provider: "platform_llm" },
];

export const adapters = new Map<ProviderId, Adapter>(all.map((a) => [a.provider, a]));
export const adapterFor = (p: ProviderId): Adapter | undefined => adapters.get(p);
export type { Adapter, CallContext, CallResult } from "./types";
