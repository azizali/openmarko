import { generateText } from "ai";
import type { Adapter } from "./types";
import { AppError } from "@app/kernel";
import { LLM_COST_PER_1K_TOKENS_MICROS, liveLanguageModel, parseModelRef, stubVector, type Vendor } from "../llm";

// `llm.complete` and `llm.embed` through invoke() (ADR 0014): one prompt in, text out, for callers that don't stream.
// Streaming chat, and choosing a model by name, are the ai module's, on the same model access (../llm.ts).
// Live calls go through the AI SDK; stub replies are short and fixed in shape.
const tokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));
const cost = (n: number) => Math.ceil((n * LLM_COST_PER_1K_TOKENS_MICROS) / 1000);
const stubComplete = (prompt: string) => `[stub] ${prompt.slice(0, 120)}`;

/** The default model when a Connection doesn't name one. */
const defaultModel: Record<Vendor, string> = {
  anthropic: "claude-haiku-5-5",
  openai: "gpt-5-mini",
  google: "gemini-3-flash",
  openrouter: "anthropic/claude-haiku-5-5",
};
const vendorOf: Record<string, Vendor> = { anthropic: "anthropic", openai: "openai", google_ai: "google", openrouter: "openrouter" };

export const llm: Adapter = {
  provider: "anthropic",
  capabilities: ["llm.complete", "llm.embed"],
  estimate: (_c, input) => tokens(String(input?.prompt ?? input?.text ?? "")),
  call: async (capability, input, { mode, secrets, provider }) => {
    if (capability === "llm.embed") {
      const text = String(input.text ?? "");
      if (mode !== "stub")
        throw new AppError(501, "not_implemented", "Embeddings go through knowledge bases (the knowledge module), not invoke().");
      return { output: stubVector(text, 8), quantity: tokens(text), costMicros: cost(tokens(text)) };
    }
    const prompt = String(input.prompt ?? "");
    if (mode === "stub") {
      const q = tokens(prompt) + tokens(stubComplete(prompt));
      return { output: { text: stubComplete(prompt) }, quantity: q, costMicros: cost(q) };
    }
    const s = await secrets();
    const vendor: Vendor = vendorOf[provider]!;
    const ref = parseModelRef(`${vendor}/${s.model ?? defaultModel[vendor]}`);
    try {
      const r = await generateText({ model: liveLanguageModel(ref, s.apiKey ?? ""), prompt, maxOutputTokens: 1024 });
      const n = r.usage.totalTokens ?? tokens(prompt) + tokens(r.text);
      return { output: { text: r.text }, quantity: n, costMicros: cost(n) };
    } catch (err) {
      throw new AppError(502, "provider_error", err instanceof Error ? err.message : String(err));
    }
  },
};
