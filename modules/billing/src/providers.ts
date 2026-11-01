// Billing providers (ADR 0012). Stripe is always live (ADR 0013). The manual provider assigns a Plan with no payment.
import { AppError, hmacHex, safeEqual } from "@openmarko/kernel";

export type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

/** Maps Stripe's subscription statuses onto ours. */
export function mapStripeStatus(s: string): BillingStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "incomplete";
  }
}

/**
 * Stripe's webhook signature scheme: `Stripe-Signature: t=<unix>,v1=<hex hmac>`, where the HMAC-SHA256
 * is over `<t>.<raw body>`. Rejects anything older than `toleranceSec`.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  opts: { now?: number; toleranceSec?: number } = {},
): void {
  if (!header) throw new AppError(400, "bad_signature", "Missing Stripe-Signature header.");
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  const sig = parts.v1;
  if (!t || !sig) throw new AppError(400, "bad_signature", "Malformed Stripe-Signature header.");
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > (opts.toleranceSec ?? 300)) throw new AppError(400, "bad_signature", "Stripe signature is too old.");
  if (!safeEqual(hmacHex(secret, `${t}.${rawBody}`), sig)) throw new AppError(400, "bad_signature", "Stripe signature does not match.");
}

export type StripeClient = {
  createCustomer(input: { email: string; orgId: string }): Promise<{ id: string }>;
  createSubscription(input: {
    customerId: string;
    priceId: string;
    orgId: string;
  }): Promise<{ id: string; status: string; current_period_start: number; current_period_end: number }>;
};

/** Real Stripe calls over HTTPS with the secret key. Used only when billing is configured live. */
export function stripeClient(secretKey: string): StripeClient {
  const call = async (method: string, path: string, form: Record<string, string>) => {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok)
      throw new AppError(502, "stripe_error", String((json as { error?: { message?: string } }).error?.message ?? res.statusText));
    return json;
  };
  return {
    async createCustomer({ email, orgId }) {
      const c = await call("POST", "customers", { email, "metadata[orgId]": orgId });
      return { id: String(c.id) };
    },
    async createSubscription({ customerId, priceId, orgId }) {
      const s = await call("POST", "subscriptions", {
        customer: customerId,
        "items[0][price]": priceId,
        "metadata[orgId]": orgId,
      });
      return s as never;
    },
  };
}
