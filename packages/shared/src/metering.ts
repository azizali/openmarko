// Which integrations cost us money per use (ADR 0012, metering rule).
// Metered providers write a usage_events row for every billable call, and a
// Plan decides what that costs its Organization (billing.plan_meters).
// Providers not listed here are free to use and write no usage.
// The list is the single place to change this: a new paid provider must be added here.
import type { ProviderId } from "./integrations";

export type Meter = { meter: string; unit: string };

export const metering: Partial<Record<ProviderId, Meter>> = {
  managed_email: { meter: "email.sent", unit: "email" },
  ses: { meter: "email.sent", unit: "email" },
  resend: { meter: "email.sent", unit: "email" },
  mailgun: { meter: "email.sent", unit: "email" },
  postmark: { meter: "email.sent", unit: "email" },
  sendgrid: { meter: "email.sent", unit: "email" },
  managed_phone: { meter: "sms.sent", unit: "message" },
  twilio: { meter: "sms.sent", unit: "message" },
  telnyx: { meter: "sms.sent", unit: "message" },
  dataforseo: { meter: "dataforseo.request", unit: "request" },
  anthropic: { meter: "llm.tokens", unit: "token" },
  openai: { meter: "llm.tokens", unit: "token" },
  google_ai: { meter: "llm.tokens", unit: "token" },
  openrouter: { meter: "llm.tokens", unit: "token" },
  platform_llm: { meter: "llm.tokens", unit: "token" },
};

export const meterOf = (p: ProviderId): Meter | null => metering[p] ?? null;
