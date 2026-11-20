// Providers not listed here are free to use and write no usage.
// The list is the single place to change this: a new paid provider must be added here.
import type { ProviderId } from "./integrations";

export type Meter = { meter: string; unit: string };

export const metering: Partial<Record<ProviderId, Meter>> = {
  resend: { meter: "email.sent", unit: "email" },
  mailgun: { meter: "email.sent", unit: "email" },
  postmark: { meter: "email.sent", unit: "email" },
  sendgrid: { meter: "email.sent", unit: "email" },
  smtp: { meter: "email.sent", unit: "email" },
  anthropic: { meter: "llm.tokens", unit: "token" },
  openai: { meter: "llm.tokens", unit: "token" },
  google_ai: { meter: "llm.tokens", unit: "token" },
  openrouter: { meter: "llm.tokens", unit: "token" },
};

/** Every meter a Plan can sell, for the admin area's Plan editor. */
export const meters = [...new Set(Object.values(metering).map((m) => m.meter))];

export const meterOf = (p: ProviderId): Meter | null => metering[p] ?? null;
