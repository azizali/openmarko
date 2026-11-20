import type { Adapter } from "./types";
import { llm } from "./llm";
import { emailAdapters } from "./email";
import { slack } from "./slack";
import type { ProviderId } from "@app/shared";

/** Every adapter we have, by provider. Adding a provider = one adapter here plus a catalog entry (@app/shared). */
const all: Adapter[] = [
  ...emailAdapters,
  slack,
  { ...llm, provider: "anthropic" },
  { ...llm, provider: "openai" },
  { ...llm, provider: "google_ai" },
  { ...llm, provider: "openrouter" },
];

export const adapters = new Map<ProviderId, Adapter>(all.map((a) => [a.provider, a]));
export const adapterFor = (p: ProviderId): Adapter | undefined => adapters.get(p);
export type { Adapter, CallContext, CallResult } from "./types";
