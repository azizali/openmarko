import { AppError, hmacHex, parseJsonObject, safeEqual, type AppContext } from "@openmarko/kernel";
import { providerOf } from "@openmarko/shared";
import { storeWebhook } from "./service";

/**
 * Checks a provider's webhook. The signature is HMAC-SHA256 of the raw body, hex, in `x-openmarko-signature`,
 * with the secret in WEBHOOK_SECRET_<PROVIDER>. No secret configured means the webhook is refused (fail closed).
 */
export function verifyProviderWebhook(provider: string, rawBody: string, header: string | null, secrets: Record<string, string>): void {
  const secret = secrets[provider.toLowerCase()];
  if (!secret) throw new AppError(401, "unauthorized", `Webhooks from ${provider} aren't configured.`);
  if (!header) throw new AppError(401, "unauthorized", "Missing signature.");
  if (!safeEqual(hmacHex(secret, rawBody), header)) throw new AppError(401, "unauthorized", "Signature doesn't match.");
}

/** Accepts a verified webhook: stores it once (by the provider's event id), so retries do nothing twice. */
export async function receiveWebhook(
  ctx: AppContext,
  provider: string,
  rawBody: string,
  header: string | null,
): Promise<{ stored: boolean }> {
  if (!providerOf(provider as never)) throw new AppError(404, "not_found", `Unknown provider ${provider}.`);
  verifyProviderWebhook(provider, rawBody, header, ctx.cfg.webhookSecrets);
  const payload = parseJsonObject(rawBody) as { id?: string } & Record<string, unknown>;
  if (!payload.id) throw new AppError(422, "invalid", "Webhook has no event id.");
  const stored = await storeWebhook(ctx, provider, String(payload.id), payload);
  return { stored };
}
