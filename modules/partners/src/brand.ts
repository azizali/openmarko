import { z } from "zod";
import { appConfig, planLimit, type AppContext } from "@app/kernel";
import { readSetting, writeSetting } from "@app/settings";
import { isPartnerPlan } from "./service";

/** A Partner's brand: what its Clients see instead of ours (ADR 0004). Stored in settings, scope 'partner'. */
export const brandSchema = z.object({
  name: z.string().min(1).max(60),
  assistant: z.string().max(40).default("AI Assistant"),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#db2777"),
  logo: z.string().url().nullable().default(null),
});
export type Brand = z.infer<typeof brandSchema>;

/** What an Organization with no Partner brand shows: the app's own name. */
export const defaultBrand = (): Brand => ({ name: appConfig.name, assistant: "AI Assistant", accent: "#db2777", logo: null });

export async function brandFor(ctx: AppContext, partnerId: string | null): Promise<Brand> {
  if (!partnerId) return defaultBrand();
  const s = await readSetting<Brand>(ctx, "partner", partnerId, "whitelabel");
  return s?.value ?? defaultBrand();
}

/**
 * The Partner whose brand an Organization works under (ADR 0004): its Partner's, or
 * its own if it is a Partner. Null for the app's own brand: no such Partner, its Plan lapsed, or it hasn't saved one.
 */
export async function brandOwnerOf(ctx: AppContext, org: { id: string; partnerId: string | null }): Promise<string | null> {
  const owner = org.partnerId ?? org.id;
  if (!(await isPartnerPlan(ctx, owner))) return null;
  return (await readSetting<Brand>(ctx, "partner", owner, "whitelabel")) ? owner : null;
}

export async function setBrand(ctx: AppContext, partnerId: string, brand: unknown, by: string): Promise<void> {
  if (!(await isPartnerPlan(ctx, partnerId))) throw planLimit("partner");
  await writeSetting(ctx, "partner", partnerId, "whitelabel", brand, { by });
}
