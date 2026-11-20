// `notify.send` through a Slack incoming webhook: one message to the channel the webhook was made for. Free, so
// nothing is metered. The stub records the call and returns like a real one.
import { AppError } from "@app/kernel";
import type { Adapter } from "./types";

export type NotifyInput = { text: string };
export type NotifyOutput = { delivered: true };

export const slack: Adapter = {
  provider: "slack",
  capabilities: ["notify.send"],
  call: async (_capability, input, c) => {
    const text = String((input as NotifyInput)?.text ?? "").trim();
    if (!text) throw new AppError(422, "invalid", "A notification needs text.");
    if (c.mode === "stub") return { output: { delivered: true } satisfies NotifyOutput, quantity: 1, costMicros: 0 };
    const { webhookUrl } = await c.secrets();
    const res = await fetch(webhookUrl!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new AppError(502, "provider_failed", `Slack refused the message (${res.status}).`);
    return { output: { delivered: true } satisfies NotifyOutput, quantity: 1, costMicros: 0 };
  },
};
