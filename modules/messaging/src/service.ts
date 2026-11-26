// Sending the app's email. The app sends from its sender (the `messaging` app setting) through an email Connection
// (an Organization's own, else the app's). Mail is queued and sent by the worker, retried with backoff; while the
// app can't send yet (no sender or no provider) it skips it, so sign-up still works and Platform admin → Email says why.
import { z } from "zod";
import { appConfig, AppError, type AppContext, type OutgoingEmail } from "@app/kernel";
import { platformAdminLabel } from "@app/shared";
import { readAppSetting } from "@app/settings";
import { invoke, pickConnection } from "@app/integrations";
import { render } from "./templates";

const optionalEmail = z.union([z.literal(""), z.email()]).default("");

/** The app's sender: edited in Platform admin → Email (a form from this schema). */
export const senderSchema = z.object({
  fromEmail: z
    .union([z.literal(""), z.email()])
    .default("")
    .describe("The address emails come from, on a domain the provider has verified"),
  fromName: z.string().max(80).default("").describe("The name people see; empty: the app's name"),
  replyTo: optionalEmail.describe("Where replies go (optional)"),
});
export type Sender = z.infer<typeof senderSchema>;

export const SEND_JOB = "messaging.send";

export async function senderOf(ctx: AppContext): Promise<Sender | null> {
  const s = await readAppSetting<Sender>(ctx, "messaging");
  return s?.value.fromEmail ? s.value : null;
}

/** Whether the app can send now, and through what. */
export async function emailStatus(ctx: AppContext) {
  const [sender, conn] = await Promise.all([senderOf(ctx), pickConnection(ctx, null, "email.send")]);
  return {
    sender,
    connection: conn ? { id: conn.id, providerId: conn.providerId, mode: conn.mode } : null,
    ready: !!sender && !!conn,
  };
}

/** Renders and sends one email now, through the Organization's provider if it has one, else the app's. */
export async function sendNow(ctx: AppContext, msg: OutgoingEmail): Promise<{ messageId: string }> {
  const sender = await senderOf(ctx);
  if (!sender) throw new AppError(409, "no_sender", `Set the app's sender (${platformAdminLabel} → Email) first.`);
  // An invitation links to the app, where the person accepts it.
  const data =
    msg.template === "invitation" && msg.data.invitationId
      ? { ...msg.data, url: `${ctx.cfg.appUrl}/accept-invitation/${msg.data.invitationId}` }
      : msg.data;
  const fromName = sender.fromName || appConfig.name;
  const mail = render({ template: msg.template, data }, appConfig.name);
  const { output } = await invoke<{ messageId: string }>(ctx, msg.organizationId ?? null, "email.send", {
    to: msg.to,
    ...mail,
    from: { email: sender.fromEmail, name: fromName },
    replyTo: sender.replyTo || null,
  });
  return { messageId: output.messageId };
}

/** Queues an email. False (and nothing queued) when the app can't send yet. */
export async function queueEmail(ctx: AppContext, msg: OutgoingEmail): Promise<boolean> {
  if (!(await emailStatus(ctx)).ready) return false;
  if (!ctx.enqueue) throw new Error("No queue in this process to send email with.");
  await ctx.enqueue(SEND_JOB, msg as unknown as Record<string, unknown>, { organizationId: msg.organizationId });
  return true;
}
