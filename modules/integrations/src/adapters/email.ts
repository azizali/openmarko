import type { Adapter } from "./types";
import { AppError } from "@openmarko/kernel";

// Sending email (metered: email.sent, ADR 0012). The stub returns a message id and writes usage like a real send.
const emailAdapter = (provider: string): Adapter => ({
  provider: provider as Adapter["provider"],
  capabilities: ["email.send"],
  estimate: () => 1,
  call: async (_capability, input, { mode }) => {
    if (mode === "stub") {
      return { output: { messageId: `stub-${String(input.to).length}-${Date.now()}`, accepted: true }, quantity: 1, costMicros: 300 };
    }
    throw new AppError(501, "not_implemented", `Live sending through ${provider} isn't built yet.`);
  },
});

export const emailAdapters = ["managed_email", "ses", "resend", "mailgun", "postmark", "sendgrid"].map(emailAdapter);
