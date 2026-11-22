// Providers not listed here are free to use and write no usage.
// The list is the single place to change this: a new paid provider must be added here.
import type { ProviderId } from "./integrations";

export type Meter = {
  meter: string;
  unit: string;
  /**
   * Recorded for what it costs the app, never checked against the Plan: the feature sells its use through limits
   * instead (SEO's keywords and checks). Not offered in the Plan editor.
   */
  costOnly?: boolean;
};

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
  dataforseo: { meter: "seo.requests", unit: "request", costOnly: true },
  google_places: { meter: "places.requests", unit: "request", costOnly: true },
};

/** Every meter a Plan can sell, for the admin area's Plan editor. */
export const meters = [
  ...new Set(
    Object.values(metering)
      .filter((m) => !m.costOnly)
      .map((m) => m.meter),
  ),
];

export const meterOf = (p: ProviderId): Meter | null => metering[p] ?? null;
