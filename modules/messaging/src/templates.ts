// The emails the app sends for sign-in and Organizations. Plain text with a simple HTML twin. Worded neutrally
// ("this app", the app's name), since a Partner's brand may sit on top.
import type { OutgoingEmail } from "@app/kernel";

export type Rendered = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(lines: string[], action?: { label: string; url: string }): string {
  const body = lines.map((l) => `<p style="margin:0 0 14px">${esc(l)}</p>`).join("");
  const button = action
    ? `<p style="margin:20px 0"><a href="${esc(action.url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">${esc(action.label)}</a></p><p style="margin:0;color:#666;font-size:12px">Or open this link: ${esc(action.url)}</p>`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5;color:#111;max-width:520px;margin:24px auto;padding:0 16px">${body}${button}</body></html>`;
}

const text = (lines: string[], action?: { label: string; url: string }) =>
  [...lines, ...(action ? ["", `${action.label}: ${action.url}`] : [])].join("\n");

/** One email from a template. `app` is the app's name as people know it. */
export function render(msg: Pick<OutgoingEmail, "template" | "data">, app: string): Rendered {
  const d = msg.data;
  switch (msg.template) {
    case "verify-email": {
      const lines = [`Confirm your email address to finish signing up to ${app}.`, "If you didn't sign up, you can ignore this email."];
      const action = { label: "Confirm email", url: d.url! };
      return { subject: `Confirm your email for ${app}`, text: text(lines, action), html: page(lines, action) };
    }
    case "reset-password": {
      const lines = [
        `Someone asked to reset the password for your ${app} account.`,
        "The link works once and expires soon. If it wasn't you, ignore this email: your password stays as it is.",
      ];
      const action = { label: "Choose a new password", url: d.url! };
      return { subject: `Reset your ${app} password`, text: text(lines, action), html: page(lines, action) };
    }
    case "invitation": {
      const who = d.inviter ? `${d.inviter} invited you` : "You've been invited";
      const lines = [`${who} to join ${d.organization ?? "an organization"} on ${app}${d.role ? ` as ${d.role}` : ""}.`];
      if (!d.url) lines.push("Sign in to accept it.");
      const action = d.url ? { label: "Accept the invitation", url: d.url } : undefined;
      return { subject: `${who} to ${d.organization ?? app}`, text: text(lines, action), html: page(lines, action) };
    }
    case "magic-link": {
      const lines = [
        `Here's your link to sign in to ${app}.`,
        "It works once and expires in a few minutes. If you didn't ask for it, ignore this email.",
      ];
      const action = { label: "Sign in", url: d.url! };
      return { subject: `Sign in to ${app}`, text: text(lines, action), html: page(lines, action) };
    }
    case "test": {
      const lines = [`This is a test email from ${app}.`, "If you can read this, sending works."];
      return { subject: `Test email from ${app}`, text: text(lines), html: page(lines) };
    }
  }
}
