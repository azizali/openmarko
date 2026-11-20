// Integrations, in three layers (ADR 0002):
//
//   Capability  a contract the app needs ("email.send", "llm.complete"), with the operations an adapter implements.
//               Features depend on capabilities, never on a provider.
//   Provider    a catalog entry (Resend, Anthropic, Slack): how it connects, what it attaches to, which
//               capabilities it implements, and the fields a person fills in.
//   Connection  one connected instance of a provider, attached to the app, a Partner or an Organization
//               (modules/integrations).
//
// How many connections a capability takes is the capability's call: one email sender per Organization, any
// number of notification channels. Connecting a second provider for a "one" capability replaces the first.
//
// Who may connect follows what it powers: a provider needs the `permission` of every capability it implements.
// This file has no React or server imports, so both the API and the web app use it as-is.
//
// Adding a provider: one entry here, one adapter in modules/integrations/src/adapters, and a meter in metering.ts
// if it costs money.

import type { Resource } from "./access";

/** What a Connection can belong to. `app`: the app's own account, used by every Organization without its own. */
export type Attach = "app" | "partner" | "organization";
export const attachLabel: Record<Attach, string> = { app: "App", partner: "Partner", organization: "Organization" };

export type CapabilityId = "email.send" | "notify.send" | "llm.complete" | "llm.embed";

export type Capability = {
  id: CapabilityId;
  label: string;
  /** What the app does with it, in a line. */
  does: string;
  /** "one": a second connection replaces the first, per Organization. "many": all of them are used. */
  max: "one" | "many";
  /** What connecting or disconnecting something with this capability needs. */
  permission: [Resource, string];
  /** The adapter interface: what the backend calls. */
  ops: string[];
};

export const capabilities: Capability[] = [
  {
    id: "email.send",
    label: "Send email",
    does: "Sign-in emails, invitations and anything a feature sends.",
    max: "one",
    permission: ["setup", "connect"],
    ops: ["send(to, subject, text, html)"],
  },
  {
    id: "notify.send",
    label: "Notifications",
    does: "Alerts and digests in a channel.",
    max: "many",
    permission: ["setup", "connect"],
    ops: ["post(channel, text)"],
  },
  {
    id: "llm.complete",
    label: "Language models",
    does: "Text generation and the assistant, with the Organization's own key. One key per vendor may coexist.",
    max: "many",
    permission: ["setup", "connect"],
    ops: ["complete(prompt)"],
  },
  {
    id: "llm.embed",
    label: "Embeddings",
    does: "Vectors for knowledge bases.",
    max: "many",
    permission: ["setup", "connect"],
    ops: ["embed(text)"],
  },
];
export const capabilityOf = (id: CapabilityId) => capabilities.find((c) => c.id === id)!;

export type Category = "Email" | "AI models" | "Notifications";
export const categories: Category[] = ["Email", "AI models", "Notifications"];

export type Auth = "oauth" | "api_key";
/**
 * A value a person enters to connect a provider. Secret fields are encrypted into credentials (ADR 0010); the rest
 * are stored as the Connection's settings. `options` limits a field to a choice; `optional` fields may be left out.
 */
export type Field = { key: string; label: string; secret?: boolean; placeholder?: string; options?: string[]; optional?: boolean };

export type ProviderId =
  | "resend"
  | "mailgun"
  | "postmark"
  | "sendgrid"
  | "smtp"
  | "slack"
  | "anthropic"
  | "openai"
  | "google_ai"
  | "openrouter";

export type Provider = {
  id: ProviderId;
  name: string;
  /** Who makes it, when that's not obvious from the name. */
  vendor?: string;
  mark: string;
  color: string;
  category: Category;
  auth: Auth;
  /** What an Organization's Connection attaches to. Any provider can also be connected once for the whole app. */
  attach: Attach;
  blurb: string;
  capabilities: CapabilityId[];
  /** What it does that others in its category don't. Shown, not wired to features. */
  extras?: string[];
  /** For API key auth. OAuth providers need none. */
  fields?: Field[];
};

const p = (x: Provider) => x;

export const providers: Provider[] = [
  p({
    id: "resend",
    name: "Resend",
    mark: "R",
    color: "#000000",
    category: "Email",
    auth: "api_key",
    attach: "organization",
    blurb: "Simple, developer-friendly email.",
    capabilities: ["email.send"],
    fields: [{ key: "key", label: "API key", secret: true, placeholder: "re_…" }],
  }),
  p({
    id: "postmark",
    name: "Postmark",
    mark: "PM",
    color: "#ffde00",
    category: "Email",
    auth: "api_key",
    attach: "organization",
    blurb: "Best inbox placement for one-to-one email.",
    capabilities: ["email.send"],
    fields: [{ key: "key", label: "Server token", secret: true }],
  }),
  p({
    id: "sendgrid",
    name: "SendGrid",
    vendor: "Twilio",
    mark: "SG",
    color: "#1a82e2",
    category: "Email",
    auth: "api_key",
    attach: "organization",
    blurb: "Fine if you already have an account.",
    capabilities: ["email.send"],
    fields: [{ key: "key", label: "API key", secret: true, placeholder: "SG.…" }],
  }),
  p({
    id: "mailgun",
    name: "Mailgun",
    mark: "MG",
    color: "#f06b66",
    category: "Email",
    auth: "api_key",
    attach: "organization",
    blurb: "Long-standing, with inbound routing.",
    capabilities: ["email.send"],
    fields: [
      { key: "key", label: "API key", secret: true },
      { key: "domain", label: "Sending domain", placeholder: "mg.example.com" },
      { key: "region", label: "Region", options: ["US", "EU"], optional: true },
    ],
  }),
  p({
    id: "smtp",
    name: "SMTP",
    mark: "@",
    color: "#52525b",
    category: "Email",
    auth: "api_key",
    attach: "organization",
    blurb: "Any SMTP server: Amazon SES's SMTP credentials, your mail host, Mailpit in development.",
    capabilities: ["email.send"],
    fields: [
      { key: "host", label: "Host", placeholder: "localhost" },
      { key: "port", label: "Port", placeholder: "1025", optional: true },
      { key: "secure", label: "TLS from the start (port 465)", options: ["yes", "no"], optional: true },
      { key: "username", label: "Username", optional: true },
      { key: "password", label: "Password", secret: true, optional: true },
    ],
  }),
  p({
    id: "slack",
    name: "Slack",
    mark: "#",
    color: "#4a154b",
    category: "Notifications",
    auth: "api_key",
    attach: "organization",
    blurb: "Alerts and digests in a channel, through an incoming webhook.",
    capabilities: ["notify.send"],
    fields: [{ key: "webhookUrl", label: "Incoming webhook URL", secret: true, placeholder: "https://hooks.slack.com/services/…" }],
  }),
  p({
    id: "anthropic",
    name: "Anthropic",
    mark: "A",
    color: "#d97757",
    category: "AI models",
    auth: "api_key",
    attach: "organization",
    blurb: "Claude models for writing and the assistant. Pay per token.",
    capabilities: ["llm.complete"],
    fields: [{ key: "apiKey", label: "API key", secret: true }],
  }),
  p({
    id: "openai",
    name: "OpenAI",
    mark: "O",
    color: "#10a37f",
    category: "AI models",
    auth: "api_key",
    attach: "organization",
    blurb: "GPT models for writing, the assistant and embeddings. Pay per token.",
    capabilities: ["llm.complete", "llm.embed"],
    fields: [{ key: "apiKey", label: "API key", secret: true }],
  }),
  p({
    id: "google_ai",
    name: "Google AI",
    mark: "G",
    color: "#4285f4",
    category: "AI models",
    auth: "api_key",
    attach: "organization",
    blurb: "Gemini models for writing, the assistant and embeddings. Pay per token.",
    capabilities: ["llm.complete", "llm.embed"],
    fields: [{ key: "apiKey", label: "API key", secret: true }],
  }),
  p({
    id: "openrouter",
    name: "OpenRouter",
    mark: "R",
    color: "#6467f2",
    category: "AI models",
    auth: "api_key",
    attach: "organization",
    blurb: "One key for many models. Pay per token.",
    capabilities: ["llm.complete"],
    fields: [{ key: "apiKey", label: "API key", secret: true }],
  }),
];
export const providerOf = (id: ProviderId) => providers.find((x) => x.id === id);
export const providersFor = (c: CapabilityId) => providers.filter((x) => x.capabilities.includes(c));
/** Everything needed to connect or disconnect it: the permission of each capability it implements. */
export const permissionsFor = (x: Provider) => [
  ...new Map(
    x.capabilities.map((c) => {
      const pm = capabilityOf(c).permission;
      return [pm.join("."), pm];
    }),
  ).values(),
];
