import { z } from "zod";
import type { AppContext } from "@openmarko/kernel";
import { readSetting, registerSetting, writeSetting } from "@openmarko/settings";

/** A Partner's brand: what its Clients see instead of ours (ADR 0004). Stored in settings, scope 'partner'. */
export const brandSchema = z.object({
  name: z.string().min(1).max(60),
  assistant: z.string().max(40).default("AI Assistant"),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#111111"),
  logo: z.string().url().nullable().default(null),
});
export type Brand = z.infer<typeof brandSchema>;

registerSetting("whitelabel", brandSchema);

export const defaultBrand: Brand = { name: "OpenMarko", assistant: "AI Assistant", accent: "#111111", logo: null };

export async function brandFor(ctx: AppContext, partnerId: string | null): Promise<Brand> {
  if (!partnerId) return defaultBrand;
  const s = await readSetting<Brand>(ctx.db, "partner", partnerId, "whitelabel");
  return s ? brandSchema.parse(s.value) : defaultBrand;
}

export async function setBrand(ctx: AppContext, partnerId: string, brand: unknown, by: string): Promise<void> {
  await writeSetting(ctx.db, "partner", partnerId, "whitelabel", brand, { by });
}
