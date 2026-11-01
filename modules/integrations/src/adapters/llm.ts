import type { Adapter } from "./types";
import { AppError } from "@openmarko/kernel";

// Model access (ADR 0014). `complete` writes text; `embed` returns vectors. Stub replies are short and fixed in shape.
const COST_PER_1K_TOKENS_MICROS = 3000;
const tokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

const stubComplete = (prompt: string) => `[stub] ${prompt.slice(0, 120)}`;
const stubEmbed = (text: string) => Array.from({ length: 8 }, (_, i) => ((text.charCodeAt(i % text.length) || 0) % 97) / 97);

/** Live: Anthropic Messages API and OpenAI Chat Completions. Not yet exercised against the live API. */
async function liveComplete(provider: string, prompt: string, key: string, model: string): Promise<{ text: string; tokens: number }> {
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new AppError(502, "provider_error", json?.error?.message ?? res.statusText);
    return { text: json.content?.[0]?.text ?? "", tokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0) };
  }
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new AppError(502, "provider_error", json?.error?.message ?? res.statusText);
    return { text: json.choices?.[0]?.message?.content ?? "", tokens: json.usage?.total_tokens ?? 0 };
  }
  throw new AppError(501, "not_implemented", `${provider} live calls are not implemented yet.`);
}

export const llm: Adapter = {
  provider: "platform_llm",
  capabilities: ["llm.complete", "llm.embed"],
  estimate: (_c, input) => tokens(String(input?.prompt ?? input?.text ?? "")),
  call: async (capability, input, { mode, secrets, provider }) => {
    if (capability === "llm.embed") {
      const text = String(input.text ?? "");
      return { output: stubEmbed(text), quantity: tokens(text), costMicros: Math.ceil((tokens(text) * COST_PER_1K_TOKENS_MICROS) / 1000) };
    }
    const prompt = String(input.prompt ?? "");
    if (mode === "stub") {
      const q = tokens(prompt) + tokens(stubComplete(prompt));
      return { output: { text: stubComplete(prompt) }, quantity: q, costMicros: Math.ceil((q * COST_PER_1K_TOKENS_MICROS) / 1000) };
    }
    const s = await secrets();
    // The platform default is a key plus the vendor it belongs to; a vendor's own connection names itself.
    const vendor = provider === "platform_llm" ? (s.vendor ?? "anthropic") : provider;
    const model = s.model ?? (vendor === "anthropic" ? "claude-haiku-5-5" : "gpt-5-mini");
    const r = await liveComplete(vendor, prompt, s.apiKey ?? "", model);
    return { output: { text: r.text }, quantity: r.tokens, costMicros: Math.ceil((r.tokens * COST_PER_1K_TOKENS_MICROS) / 1000) };
  },
};
