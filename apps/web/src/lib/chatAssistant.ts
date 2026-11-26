// Which widget the app's chat uses (ADR 0031). The Widgets page and Platform admin → Models change it; the floating chat in the
// app listens, so it switches without a reload.
export const CHAT_ASSISTANT_CHANGED = "app:chat-assistant-changed";

export const announceChatAssistantChanged = () => window.dispatchEvent(new Event(CHAT_ASSISTANT_CHANGED));

export type ChatLevel = "organization" | "partner" | "app" | "builtin";

/** Who made the choice, as a sentence fragment: "your organization", "your Partner". */
export const levelWho: Record<ChatLevel, string> = {
  organization: "your organization",
  partner: "your Partner",
  app: "the app",
  builtin: "default",
};
