// Choosing a model. A caller names one explicitly (`anthropic/claude-sonnet-5-5`) or by one of the app's custom names
// (`chat-pro`), which the app points at a model with its settings, so the model behind a name can change without
// touching what uses it. No name: the app's default.
import { z } from "zod";
import type { LanguageModel } from "ai";
import { invalid, type AppContext } from "@app/kernel";
import { readAppSetting } from "@app/settings";
import { languageModel, parseModelRef, type ModelScope } from "@app/integrations";

const NAME = /^[a-z][a-z0-9-]{0,39}$/;
const modelId = z.string().refine((v) => {
  try {
    parseModelRef(v);
    return true;
  } catch {
    return false;
  }
}, "a model is <vendor>/<model>, e.g. anthropic/claude-sonnet-5-5");

/** The app's model settings: edited in Admin → Models. */
export const aiSettingsSchema = z.object({
  defaultModel: z.string().default("").describe("Used when a request names no model: a custom name below, or <vendor>/<model>"),
  models: z
    .record(
      z.string().regex(NAME, "a custom name is lowercase letters, digits and dashes"),
      z.object({
        model: modelId,
        temperature: z.number().min(0).max(2).optional(),
        maxOutputTokens: z.number().int().min(1).max(64000).optional(),
      }),
    )
    .default({})
    .describe("The app's own model names, e.g. chat-pro → anthropic/claude-sonnet-5-5"),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export async function aiSettings(ctx: AppContext): Promise<AiSettings> {
  return (await readAppSetting<AiSettings>(ctx, "ai"))?.value ?? { defaultModel: "", models: {} };
}

export type Chosen = {
  /** What was asked for: a custom name, or the model's own id. */
  name: string;
  modelId: string;
  model: LanguageModel;
  connectionId: string;
  /** The key's provider (`anthropic`, `openai`…), as usage records it. */
  providerId: string;
  mode: "stub" | "live";
  /** The key's Organization, when it's the Organization's own (its usage then isn't the app's cost). */
  keyOrganizationId: string | null;
  settings: { temperature?: number; maxOutputTokens?: number };
};

/** The model for a request, with its key and settings. */
export async function chooseModel(ctx: AppContext, scope: ModelScope, asked?: string | null): Promise<Chosen> {
  const cfg = await aiSettings(ctx);
  const name = asked || cfg.defaultModel;
  if (!name) throw invalid("Name a model, or set the app's default model (Admin → Models).");
  const custom = cfg.models[name];
  const id = custom?.model ?? name;
  if (!custom && !id.includes("/")) throw invalid(`"${name}" isn't one of the app's model names, nor a <vendor>/<model>.`);
  const r = await languageModel(ctx, scope, id);
  return {
    name,
    modelId: id,
    model: r.model,
    connectionId: r.connectionId,
    providerId: r.providerId,
    mode: r.mode,
    keyOrganizationId: r.organizationId,
    settings: { temperature: custom?.temperature, maxOutputTokens: custom?.maxOutputTokens },
  };
}
