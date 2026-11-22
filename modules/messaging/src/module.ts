import { defineModule, type AppContext, type JobDefinition, type OutgoingEmail } from "@app/kernel";
import { queueEmail, SEND_JOB, senderSchema, sendNow } from "./service";
import { messagingRoutes } from "./routes";

// Messaging: the app's email. It owns the `messaging` setting (the sender), the send job, and Platform admin → Email.
// It sets ctx.email, through which identity sends sign-in emails.
export const messagingModule = defineModule({
  id: "messaging",
  apiGroup: { name: "Messaging", description: "The app's email: its sender, the provider it uses, test sends." },
  dependsOn: ["integrations", "settings"],
  settings: [{ id: "messaging", label: "Email sender: who the app's emails come from", schema: senderSchema, scopes: ["app"] }],
  setup: (ctx) => {
    ctx.email = (msg) => queueEmail(ctx, msg);
    return { routes: messagingRoutes(ctx), jobs: [sendJob(ctx)] };
  },
});

/** Sends one queued email; a failure throws, so pg-boss retries it with backoff. */
const sendJob = (ctx: AppContext): JobDefinition => ({
  name: SEND_JOB,
  retry: { limit: 8, delaySeconds: 30, maxDelaySeconds: 2 * 3600 },
  perOrganization: true,
  run: async (data) => {
    await sendNow(ctx, data as unknown as OutgoingEmail);
  },
});
