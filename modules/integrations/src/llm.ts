// Model access through the AI SDK (ADR 0014). A model is named explicitly as `<vendor>/<model>`
// (`anthropic/claude-sonnet-5-5`, `openai/gpt-5-mini`, `google/gemini-3-flash`, `openrouter/<org>/<model>`). Its key
// is the vendor's Connection, picked Organization → app. A Connection in stub mode gets the AI SDK's mock model,
// which streams like a real one, so everything above runs the same way without a network.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { simulateReadableStream, type EmbeddingModel, type LanguageModel } from "ai";
import { MockEmbeddingModelV4, MockLanguageModelV4 } from "ai/test";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AppError, invalid, needs, type AppContext } from "@app/kernel";
import type { ProviderId } from "@app/shared";
import { connections } from "./schema";
import { readSecrets } from "./service";
import type { Mode } from "./mode";

export const vendors = ["anthropic", "openai", "google", "openrouter"] as const;
export type Vendor = (typeof vendors)[number];
export const providerOfVendor: Record<Vendor, ProviderId> = {
  anthropic: "anthropic",
  openai: "openai",
  google: "google_ai",
  openrouter: "openrouter",
};

export type ModelRef = { vendor: Vendor; model: string; id: string };

/** `anthropic/claude-sonnet-5-5` → vendor and model. OpenRouter's model ids carry their own slash. */
export function parseModelRef(ref: string): ModelRef {
  const i = ref.indexOf("/");
  const vendor = ref.slice(0, i) as Vendor;
  const model = ref.slice(i + 1);
  if (i < 1 || !vendors.includes(vendor) || !model) {
    throw invalid(`A model is named "<vendor>/<model>", with vendor one of ${vendors.join(", ")} (got "${ref}").`);
  }
  return { vendor, model, id: ref };
}

/** Where a call comes from: an Organization (its key first, metered to it), or the app's own call. */
export type ModelScope = { organizationId?: string | null };

type Keyed = { connectionId: string; providerId: ProviderId; mode: Mode; apiKey: string; organizationId: string | null };

/** The key for a vendor: its Connection, the Organization's own, else the app's. */
async function keyFor(ctx: AppContext, scope: ModelScope, vendor: Vendor): Promise<Keyed> {
  const providerId = providerOfVendor[vendor];
  const live = isNull(connections.revokedAt);
  const first = async (where: ReturnType<typeof and>) => {
    const [row] = await ctx.db
      .select()
      .from(connections)
      .where(where)
      .orderBy(sql`created_at desc`)
      .limit(1);
    return row ?? null;
  };
  const org = scope.organizationId ?? null;
  const row =
    (org ? await first(and(eq(connections.organizationId, org), eq(connections.providerId, providerId), live)) : null) ??
    (await first(and(isNull(connections.organizationId), eq(connections.targetType, "app"), eq(connections.providerId, providerId), live)));
  if (!row) throw needs(`a ${vendor} model`);
  const s = await readSecrets(ctx, row.id);
  return { connectionId: row.id, providerId, mode: row.mode as Mode, apiKey: s.apiKey ?? "", organizationId: row.organizationId };
}

/** A rough cost until per-model prices are kept: what usage records for an LLM token. */
export const LLM_COST_PER_1K_TOKENS_MICROS = 3000;

// ---------- The stub: a fixed, short reply that streams in pieces ----------

const lastUser = (prompt: unknown): string => {
  const msgs = Array.isArray(prompt) ? (prompt as { role: string; content: unknown }[]) : [];
  let last: (typeof msgs)[number] | undefined;
  for (let i = msgs.length - 1; i >= 0 && !last; i--) if (msgs[i]!.role === "user") last = msgs[i];
  const content = last?.content;
  const text =
    typeof content === "string" ? content : Array.isArray(content) ? content.map((p: { text?: string }) => p.text ?? "").join(" ") : "";
  return text.slice(0, 120);
};

const stubUsage = (text: string) => ({
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: Math.max(1, Math.ceil(text.length / 4)), text: undefined, reasoning: undefined },
});

function stubLanguageModel(ref: ModelRef): LanguageModel {
  const reply = (prompt: unknown) => `[stub ${ref.id}] You said: ${lastUser(prompt)}`;
  const usage = stubUsage;
  return new MockLanguageModelV4({
    provider: `stub.${ref.vendor}`,
    modelId: ref.model,
    doGenerate: async ({ prompt }) => {
      const text = reply(prompt);
      return { content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage: usage(text), warnings: [] };
    },
    doStream: async ({ prompt }) => {
      const text = reply(prompt);
      const words = text.split(/(?<= )/);
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            ...words.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
            { type: "text-end", id: "t" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: usage(text) },
          ],
        }),
      };
    },
  }) as unknown as LanguageModel;
}

/** A deterministic stand-in for embeddings: similar texts get similar vectors, so retrieval tests mean something. */
export function stubVector(text: string, dimensions: number): number[] {
  const v = Array.from({ length: dimensions }, () => 0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 2166136261;
    for (const ch of word) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    v[Math.abs(h) % dimensions]! += 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

// ---------- Resolving a model ----------

export type Resolved<M> = {
  model: M;
  connectionId: string;
  providerId: ProviderId;
  mode: Mode;
  ref: ModelRef;
  organizationId: string | null;
};

export async function languageModel(ctx: AppContext, scope: ModelScope, refOrId: ModelRef | string): Promise<Resolved<LanguageModel>> {
  const ref = typeof refOrId === "string" ? parseModelRef(refOrId) : refOrId;
  const key = await keyFor(ctx, scope, ref.vendor);
  const base = { connectionId: key.connectionId, providerId: key.providerId, mode: key.mode, ref, organizationId: key.organizationId };
  if (key.mode === "stub") return { ...base, model: stubLanguageModel(ref) };
  if (!key.apiKey) throw new AppError(409, "needs_connection", `The ${ref.vendor} Connection has no API key.`);
  return { ...base, model: liveLanguageModel(ref, key.apiKey) };
}

/** A vendor's real model, for a key. */
export function liveLanguageModel(ref: ModelRef, apiKey: string): LanguageModel {
  const model =
    ref.vendor === "anthropic"
      ? createAnthropic({ apiKey })(ref.model)
      : ref.vendor === "openai"
        ? createOpenAI({ apiKey })(ref.model)
        : ref.vendor === "google"
          ? createGoogleGenerativeAI({ apiKey })(ref.model)
          : createOpenRouter({ apiKey }).chat(ref.model);
  return model as LanguageModel;
}

/** An embedding model, with the dimensions its vectors have (knowledge bases record both). */
export async function embeddingModel(
  ctx: AppContext,
  scope: ModelScope,
  refOrId: ModelRef | string,
  dimensions: number,
): Promise<Resolved<EmbeddingModel>> {
  const ref = typeof refOrId === "string" ? parseModelRef(refOrId) : refOrId;
  if (ref.vendor !== "openai" && ref.vendor !== "google")
    throw invalid(`Embeddings come from openai or google models (got ${ref.vendor}).`);
  const key = await keyFor(ctx, scope, ref.vendor);
  const base = { connectionId: key.connectionId, providerId: key.providerId, mode: key.mode, ref, organizationId: key.organizationId };
  if (key.mode === "stub") {
    const model = new MockEmbeddingModelV4({
      provider: `stub.${ref.vendor}`,
      modelId: ref.model,
      maxEmbeddingsPerCall: 100,
      doEmbed: async ({ values }) => ({
        embeddings: values.map((v: string) => stubVector(v, dimensions)),
        usage: { tokens: Math.ceil(values.join(" ").length / 4) },
        warnings: [],
      }),
    });
    return { ...base, model: model as unknown as EmbeddingModel };
  }
  if (!key.apiKey) throw new AppError(409, "needs_connection", `The ${ref.vendor} Connection has no API key.`);
  const model =
    ref.vendor === "openai"
      ? createOpenAI({ apiKey: key.apiKey }).embedding(ref.model)
      : createGoogleGenerativeAI({ apiKey: key.apiKey }).textEmbeddingModel(ref.model);
  return { ...base, model: model as unknown as EmbeddingModel };
}

// ---------- What a vendor offers ----------

/** One model a vendor offers, as its own API lists it. Prices are USD per million tokens, when the vendor says. */
export type VendorModel = {
  /** `<vendor>/<model>`, what a Connection or an Assistant names. */
  id: string;
  vendor: Vendor;
  model: string;
  name: string;
  kind: "chat" | "embedding" | "other";
  contextLength: number | null;
  pricing: { input: number; output: number } | null;
};

const stubModels: Record<Vendor, { model: string; name: string; kind: VendorModel["kind"] }[]> = {
  anthropic: [
    { model: "claude-haiku-5-5", name: "Claude Haiku 5.5", kind: "chat" },
    { model: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", kind: "chat" },
  ],
  openai: [
    { model: "gpt-5-mini", name: "gpt-5-mini", kind: "chat" },
    { model: "text-embedding-3-small", name: "text-embedding-3-small", kind: "embedding" },
  ],
  google: [
    { model: "gemini-3-flash", name: "Gemini 3 Flash", kind: "chat" },
    { model: "gemini-embedding-001", name: "Gemini Embedding", kind: "embedding" },
  ],
  openrouter: [{ model: "anthropic/claude-haiku-5.5", name: "Anthropic: Claude Haiku 5.5", kind: "chat" }],
};

const openaiKind = (id: string): VendorModel["kind"] => {
  if (id.startsWith("text-embedding")) return "embedding";
  if (/realtime|audio|tts|transcribe|whisper|image|dall-e|moderation|search|embedding|instruct|codex/.test(id)) return "other";
  return /^(gpt-|o[1-9]|chatgpt)/.test(id) ? "chat" : "other";
};

async function vendorJson<T>(vendor: Vendor, url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    const why = res.status === 401 || res.status === 403 ? "the key was refused" : `it answered ${res.status}`;
    throw new AppError(502, "provider_error", `${vendor} couldn't list its models: ${why}. ${body}`);
  }
  return (await res.json()) as T;
}

/** Asks the vendor's own API for its models, with the key. */
export async function fetchVendorModels(vendor: Vendor, apiKey: string): Promise<VendorModel[]> {
  const row = (model: string, name: string, kind: VendorModel["kind"], extra: Partial<VendorModel> = {}): VendorModel => ({
    id: `${vendor}/${model}`,
    vendor,
    model,
    name,
    kind,
    contextLength: null,
    pricing: null,
    ...extra,
  });
  switch (vendor) {
    case "openai": {
      const r = await vendorJson<{ data: { id: string }[] }>(vendor, "https://api.openai.com/v1/models", {
        authorization: `Bearer ${apiKey}`,
      });
      return r.data.map((m) => row(m.id, m.id, openaiKind(m.id)));
    }
    case "anthropic": {
      const r = await vendorJson<{ data: { id: string; display_name?: string }[] }>(
        vendor,
        "https://api.anthropic.com/v1/models?limit=1000",
        {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      );
      return r.data.map((m) => row(m.id, m.display_name ?? m.id, "chat"));
    }
    case "google": {
      type G = { name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number };
      const r = await vendorJson<{ models?: G[] }>(vendor, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
        "x-goog-api-key": apiKey,
      });
      return (r.models ?? []).map((m) => {
        const methods = m.supportedGenerationMethods ?? [];
        const kind = methods.includes("generateContent") ? "chat" : methods.includes("embedContent") ? "embedding" : "other";
        return row(m.name.replace(/^models\//, ""), m.displayName ?? m.name, kind, { contextLength: m.inputTokenLimit ?? null });
      });
    }
    case "openrouter": {
      type O = { id: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string } };
      const r = await vendorJson<{ data: O[] }>(vendor, "https://openrouter.ai/api/v1/models", { authorization: `Bearer ${apiKey}` });
      const perMillion = (v?: string) => (v === undefined ? null : Math.round(Number(v) * 1e6 * 1000) / 1000);
      return r.data.map((m) => {
        const input = perMillion(m.pricing?.prompt);
        const output = perMillion(m.pricing?.completion);
        return row(m.id, m.name ?? m.id, "chat", {
          contextLength: m.context_length ?? null,
          pricing: input !== null && output !== null ? { input, output } : null,
        });
      });
    }
  }
}

const MODELS_TTL_MS = 10 * 60 * 1000;
const modelsCache = new Map<string, { at: number; models: VendorModel[] }>();

/**
 * The models a vendor offers through the key that would serve `scope`: asked of the vendor's own API and kept for ten
 * minutes per Connection, so a page can ask freely. A stub Connection lists a few fixed ones. Chat models first.
 */
export async function listModels(
  ctx: AppContext,
  scope: ModelScope,
  vendor: Vendor,
  opts: { fresh?: boolean } = {},
): Promise<VendorModel[]> {
  const key = await keyFor(ctx, scope, vendor);
  if (key.mode === "stub") {
    return stubModels[vendor].map((m) => ({ id: `${vendor}/${m.model}`, vendor, ...m, contextLength: null, pricing: null }));
  }
  if (!key.apiKey) throw new AppError(409, "needs_connection", `The ${vendor} Connection has no API key.`);
  const hit = modelsCache.get(key.connectionId);
  if (hit && !opts.fresh && Date.now() - hit.at < MODELS_TTL_MS) return hit.models;
  const order: Record<VendorModel["kind"], number> = { chat: 0, embedding: 1, other: 2 };
  const models = (await fetchVendorModels(vendor, key.apiKey)).toSorted(
    (a, b) => order[a.kind] - order[b.kind] || a.model.localeCompare(b.model),
  );
  modelsCache.set(key.connectionId, { at: Date.now(), models });
  return models;
}

/** For the platform admin area: which vendors the app can reach with its own key, and in what mode. */
export async function vendorKeys(ctx: AppContext): Promise<{ vendor: Vendor; connected: boolean; mode: Mode | null }[]> {
  return Promise.all(
    vendors.map(async (vendor) => {
      try {
        const k = await keyFor(ctx, {}, vendor);
        return { vendor, connected: true, mode: k.mode };
      } catch {
        return { vendor, connected: false, mode: null };
      }
    }),
  );
}
