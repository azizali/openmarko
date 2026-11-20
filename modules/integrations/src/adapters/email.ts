// Sending email (metered: email.sent, ADR 0012). One input for every provider, so messaging sends the same way
// whatever is connected. Live: Resend, Postmark, SendGrid and Mailgun over their HTTP APIs, and any SMTP server
// (Amazon SES's SMTP credentials, Mailpit in development). The stub returns a message id and writes usage like a real send.
import { createTransport } from "nodemailer";
import type { Adapter, CallContext } from "./types";
import { AppError } from "@app/kernel";

/** What `email.send` takes, from every caller. */
export type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from: { email: string; name?: string };
  replyTo?: string | null;
};
export type EmailOutput = { messageId: string; accepted: true };

const fromHeader = (f: EmailInput["from"]) => (f.name ? `${f.name.replace(/["<>]/g, "")} <${f.email}>` : f.email);

/** A provider's error, with what it said (the start of its body), as a 502 the caller can show. */
async function refused(provider: string, res: Response): Promise<never> {
  const body = (await res.text()).slice(0, 300);
  throw new AppError(502, "provider_failed", `${provider} refused the email (${res.status}).`, { status: res.status, body });
}

type Sender = (input: EmailInput, c: CallContext) => Promise<string>;

const senders: Record<string, Sender> = {
  resend: async (m, c) => {
    const { key } = await c.secrets();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: fromHeader(m.from),
        to: [m.to],
        subject: m.subject,
        text: m.text,
        html: m.html,
        reply_to: m.replyTo ?? undefined,
      }),
    });
    if (!res.ok) await refused("Resend", res);
    return ((await res.json()) as { id: string }).id;
  },
  postmark: async (m, c) => {
    const { key } = await c.secrets();
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "x-postmark-server-token": key!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        From: fromHeader(m.from),
        To: m.to,
        Subject: m.subject,
        TextBody: m.text,
        HtmlBody: m.html,
        ReplyTo: m.replyTo ?? undefined,
        MessageStream: "outbound",
      }),
    });
    if (!res.ok) await refused("Postmark", res);
    return ((await res.json()) as { MessageID: string }).MessageID;
  },
  sendgrid: async (m, c) => {
    const { key } = await c.secrets();
    const content = [{ type: "text/plain", value: m.text }, ...(m.html ? [{ type: "text/html", value: m.html }] : [])];
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: m.to }] }],
        from: { email: m.from.email, name: m.from.name },
        ...(m.replyTo ? { reply_to: { email: m.replyTo } } : {}),
        subject: m.subject,
        content,
      }),
    });
    if (!res.ok) await refused("SendGrid", res);
    return res.headers.get("x-message-id") ?? "sendgrid";
  },
  mailgun: async (m, c) => {
    const { key } = await c.secrets();
    const domain = c.settings.domain;
    if (!domain) throw new AppError(422, "invalid", "Mailgun needs the sending domain.");
    const base = c.settings.region === "EU" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
    const form = new FormData();
    form.set("from", fromHeader(m.from));
    form.set("to", m.to);
    form.set("subject", m.subject);
    form.set("text", m.text);
    if (m.html) form.set("html", m.html);
    if (m.replyTo) form.set("h:Reply-To", m.replyTo);
    const res = await fetch(`${base}/v3/${encodeURIComponent(domain)}/messages`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}` },
      body: form,
    });
    if (!res.ok) await refused("Mailgun", res);
    return ((await res.json()) as { id: string }).id;
  },
  smtp: async (m, c) => {
    const { password } = await c.secrets();
    const port = Number(c.settings.port || 587);
    const transport = createTransport({
      host: c.settings.host,
      port,
      // "yes": TLS from the start (port 465); otherwise STARTTLS when the server offers it.
      secure: c.settings.secure === "yes",
      ...(c.settings.username ? { auth: { user: c.settings.username, pass: password ?? "" } } : {}),
    });
    try {
      const info = await transport.sendMail({
        from: fromHeader(m.from),
        to: m.to,
        subject: m.subject,
        text: m.text,
        html: m.html,
        replyTo: m.replyTo ?? undefined,
      });
      return info.messageId;
    } catch (err) {
      throw new AppError(502, "provider_failed", `The SMTP server refused the email: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      transport.close();
    }
  },
};

function check(input: unknown): EmailInput {
  const m = input as Partial<EmailInput>;
  if (!m?.to || !m.subject || !m.text || !m.from?.email) throw new AppError(422, "invalid", "An email needs to, subject, text and from.");
  return m as EmailInput;
}

const emailAdapter = (provider: string): Adapter => ({
  provider: provider as Adapter["provider"],
  capabilities: ["email.send"],
  estimate: () => 1,
  call: async (_capability, input, c) => {
    const m = check(input);
    if (c.mode === "stub")
      return {
        output: { messageId: `stub-${m.to.length}-${Date.now()}`, accepted: true } satisfies EmailOutput,
        quantity: 1,
        costMicros: 300,
      };
    const send = senders[provider];
    if (!send) throw new AppError(501, "not_implemented", `Live sending through ${provider} isn't built yet.`);
    return { output: { messageId: await send(m, c), accepted: true } satisfies EmailOutput, quantity: 1, costMicros: 0 };
  },
});

export const emailAdapters = ["resend", "mailgun", "postmark", "sendgrid", "smtp"].map(emailAdapter);
