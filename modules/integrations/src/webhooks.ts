import { AppError, hmacHex, parseJsonObject, safeEqual, type AppContext } from "@app/kernel";
import { providerOf, type Field } from "@app/shared";
import { appCredentials, storeWebhook } from "./service";

/**
 * The secret that signs a provider's webhooks to this app (`/api/v1/webhooks/<provider>`), kept on the app's
 * Connection for that provider: the app's account is the one sending them.
 */
export const WEBHOOK_SECRET_FIELD: Field = { key: "webhookSecret", label: "Webhook signing secret", secret: true, optional: true };

/**
 * Checks a provider's webhook. The signature is HMAC-SHA256 of the raw body, hex, in `x-webhook-signature`,
 * with the secret on the app's Connection for that provider (`webhookSecret`). No secret means the webhook is
 * refused (fail closed).
 */
export function verifyProviderWebhook(provider: string, rawBody: string, header: string | null, secret: string | undefined): void {
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
  const secret = (await appCredentials(ctx, provider))?.webhookSecret;
  verifyProviderWebhook(provider, rawBody, header, secret);
  const payload = parseJsonObject(rawBody) as { id?: string } & Record<string, unknown>;
  if (!payload.id) throw new AppError(422, "invalid", "Webhook has no event id.");
  const stored = await storeWebhook(ctx, provider, String(payload.id), payload);
  return { stored };
}
