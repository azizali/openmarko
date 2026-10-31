import { brandAccent, dnsZone, product, productMark, whitelabeled } from "../lib/whitelabel";
// Who actually sends. The business brings its own email provider (or uses
// OpenMarko's) and its own phone provider (or ours). OpenMarko talks to each
// through its API: sending, delivery and bounce webhooks, inbound replies.
//
// Real build per provider:
// - Amazon SES: IAM access key with ses:SendEmail + sesv2 identity calls; Easy DKIM
//   (3 CNAMEs), custom MAIL FROM, SNS topics for bounces/complaints/deliveries,
//   a receipt rule for inbound replies. HIPAA-eligible under the AWS BAA.
// - Resend: API key; domain created via /domains returns its records; webhooks
//   for email.delivered/bounced/complained/opened/clicked; inbound via receiving.
// - Mailgun: private API key + US/EU region; domain records from /v4/domains;
//   webhooks per event; Routes forward inbound replies to OpenMarko.
// - Postmark: server token; DKIM + Return-Path; inbound stream for replies.
// - SendGrid: API key with Mail Send + Sender Authentication; Event Webhook;
//   Inbound Parse for replies.
// - Twilio / Telnyx: numbers search + buy, Hosted SMS or port-in orders, A2P
//   10DLC brand + campaign registration through their APIs, messaging webhooks.
// The record values below are shaped like the real ones but made up. Check each
// provider's BAA terms before patient data goes through it.

export type EmailProviderId = "managed" | "ses" | "resend" | "mailgun" | "postmark" | "sendgrid";
export type PhoneProviderId = "managed" | "twilio" | "telnyx";
export type Field = { key: string; label: string; secret?: boolean; placeholder?: string; options?: string[] };
export type DnsRecord = { type: "TXT" | "CNAME" | "MX"; host: string; value: string; purpose: string; ok: boolean };

export const emailProviders: Record<EmailProviderId, { name: string; mark: string; color: string; blurb: string; good: string[]; fields: Field[]; where: string; privacy: string }> = {
  managed: {
    name: `${product()} sending`, mark: productMark(), color: whitelabeled() ? brandAccent() : "#111111", blurb: "Nothing to sign up for. We send from your domain on our infrastructure.", good: ["Easiest", "Replies handled"], fields: [], where: "",
    privacy: "Covered by our BAA.",
  },
  ses: {
    name: "Amazon SES", mark: "SES", color: "#ff9900", blurb: "Cheapest at volume. Best if you already use AWS.", good: ["~$0.10 per 1,000", "HIPAA-eligible"],
    fields: [{ key: "access", label: "Access key ID", placeholder: "AKIA…" }, { key: "secret", label: "Secret access key", secret: true }, { key: "region", label: "Region", options: ["us-east-1", "us-east-2", "us-west-2", "eu-west-1"] }],
    where: "AWS console → IAM → Users → Security credentials. The user needs SES send and identity permissions.",
    privacy: "HIPAA-eligible under the AWS BAA (accept it in AWS Artifact).",
  },
  resend: {
    name: "Resend", mark: "Re", color: "#000000", blurb: "Simple and modern. Good dashboard and logs.", good: ["Quick setup"],
    fields: [{ key: "key", label: "API key", secret: true, placeholder: "re_…" }], where: "Resend → API Keys → Create (full access).", privacy: "Check with Resend whether they'll sign a BAA before sending to patients.",
  },
  mailgun: {
    name: "Mailgun", mark: "Mg", color: "#f06b66", blurb: "Long-standing, strong deliverability tools and EU hosting.", good: ["EU region", "Inbound routes"],
    fields: [{ key: "key", label: "Private API key", secret: true }, { key: "region", label: "Region", options: ["US", "EU"] }], where: "Mailgun → Account settings → API security.", privacy: "Check with Mailgun whether they'll sign a BAA before sending to patients.",
  },
  postmark: {
    name: "Postmark", mark: "Pm", color: "#ffde00", blurb: "Fast delivery for reminders and receipts.", good: ["Fastest delivery"],
    fields: [{ key: "key", label: "Server API token", secret: true }], where: "Postmark → your server → API Tokens.", privacy: "Check with Postmark whether they'll sign a BAA before sending to patients.",
  },
  sendgrid: {
    name: "SendGrid", mark: "SG", color: "#1a82e2", blurb: "Twilio's email service. Fine if you already have an account.", good: [],
    fields: [{ key: "key", label: "API key", secret: true, placeholder: "SG.…" }], where: "SendGrid → Settings → API Keys (Mail Send + Sender Authentication).", privacy: "Check with Twilio whether SendGrid is covered by a BAA before sending to patients.",
  },
};

/** The records to add at the DNS host for this provider and sending domain. */
export function dnsRecords(p: EmailProviderId, domain: string, region = "us-east-1"): DnsRecord[] {
  const root = domain.split(".").slice(-2).join(".");
  const sel = whitelabeled() ? "s" : "om"; // DKIM selector; whitelabeled, it mustn't hint at us
  const sub = domain === root ? "" : `.${domain.slice(0, -root.length - 1)}`;
  const dmarc: DnsRecord = { type: "TXT", host: `_dmarc.${root}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${root}`, purpose: "Tells inboxes what to do with fakes. Gmail and Yahoo require it", ok: false };
  const by: Record<EmailProviderId, DnsRecord[]> = {
    managed: [
      { type: "CNAME", host: `${sel}1._domainkey${sub}.${root}`, value: `${sel}1.dkim.${dnsZone()}`, purpose: "Signs your email (DKIM)", ok: false },
      { type: "CNAME", host: `${sel}2._domainkey${sub}.${root}`, value: `${sel}2.dkim.${dnsZone()}`, purpose: "Signs your email (DKIM)", ok: false },
      { type: "CNAME", host: `bounce${sub}.${root}`, value: `bounce.${dnsZone()}`, purpose: "Bounces come back to us (SPF)", ok: false },
    ],
    ses: [
      ...["k7f2", "q9ma", "x3vd"].map((k) => ({ type: "CNAME" as const, host: `${k}tz4h._domainkey.${domain}`, value: `${k}tz4h.dkim.amazonses.com`, purpose: "Signs your email (Easy DKIM)", ok: false })),
      { type: "MX", host: `bounce.${domain}`, value: `10 feedback-smtp.${region}.amazonses.com`, purpose: "Custom MAIL FROM, for bounces", ok: false },
      { type: "TXT", host: `bounce.${domain}`, value: "v=spf1 include:amazonses.com ~all", purpose: "Allows SES to send for you (SPF)", ok: false },
    ],
    resend: [
      { type: "TXT", host: `resend._domainkey.${domain}`, value: "p=MIGfMA0GCSqGSIb3DQEB…IDAQAB", purpose: "Signs your email (DKIM)", ok: false },
      { type: "MX", host: `send.${domain}`, value: `10 feedback-smtp.${region}.amazonses.com`, purpose: "Bounces", ok: false },
      { type: "TXT", host: `send.${domain}`, value: "v=spf1 include:amazonses.com ~all", purpose: "Allows Resend to send for you (SPF)", ok: false },
    ],
    mailgun: [
      { type: "TXT", host: domain, value: "v=spf1 include:mailgun.org ~all", purpose: "Allows Mailgun to send for you (SPF)", ok: false },
      { type: "TXT", host: `pic._domainkey.${domain}`, value: "k=rsa; p=MIGfMA0GCSqGSIb3DQEB…QAB", purpose: "Signs your email (DKIM)", ok: false },
      { type: "MX", host: domain, value: "10 mxa.mailgun.org", purpose: "Receives replies", ok: false },
      { type: "CNAME", host: `email.${domain}`, value: "mailgun.org", purpose: "Click and open tracking", ok: false },
    ],
    postmark: [
      { type: "TXT", host: `20261031pm._domainkey.${domain}`, value: "k=rsa;p=MIGfMA0GCSqGSIb3DQEB…QAB", purpose: "Signs your email (DKIM)", ok: false },
      { type: "CNAME", host: `pm-bounces.${domain}`, value: "pm.mtasv.net", purpose: "Return-Path, for bounces", ok: false },
    ],
    sendgrid: [
      { type: "CNAME", host: `em4821.${domain}`, value: "u3920481.wl232.sendgrid.net", purpose: "Bounces and SPF", ok: false },
      { type: "CNAME", host: `s1._domainkey.${domain}`, value: "s1.domainkey.u3920481.wl232.sendgrid.net", purpose: "Signs your email (DKIM)", ok: false },
      { type: "CNAME", host: `s2._domainkey.${domain}`, value: "s2.domainkey.u3920481.wl232.sendgrid.net", purpose: "Signs your email (DKIM)", ok: false },
    ],
  };
  return [...by[p], dmarc];
}

export const phoneProviders: Record<PhoneProviderId, { name: string; mark: string; color: string; blurb: string; good: string[]; fields: Field[]; where: string }> = {
  managed: { name: `${product()} numbers`, mark: productMark(), color: whitelabeled() ? brandAccent() : "#111111", blurb: "We get the numbers and file the carrier registration for you. Billed with your plan.", good: ["Easiest", "Registration filed for you"], fields: [], where: "" },
  twilio: {
    name: "Twilio", mark: "Tw", color: "#f22f46", blurb: "Use your own Twilio account. You see every message and call in Twilio too.", good: ["Your account", "BAA available"],
    fields: [{ key: "sid", label: "Account SID", placeholder: "AC…" }, { key: "token", label: "Auth token", secret: true }], where: "Twilio console → Account info, on the home page.",
  },
  telnyx: {
    name: "Telnyx", mark: "Tx", color: "#00c08b", blurb: "Lower per-message prices, own network.", good: ["Lower cost"],
    fields: [{ key: "key", label: "API key", secret: true, placeholder: "KEY…" }], where: "Telnyx portal → Auth → API keys.",
  },
};

/** Local numbers for an area code (mock search). */
export const searchNumbers = (area: string) => [118, 204, 377, 451, 562, 689].map((n, i) => `(${area || "512"}) ${[555, 555, 330, 662, 791, 555][i]}-${String(n * 7 + 1000).slice(0, 4)}`);
