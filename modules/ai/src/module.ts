import { defineModule } from "@app/kernel";
import { aiSettingsSchema } from "./models";
import { chatAssistantSchema, NAMESPACE as CHAT_ASSISTANT } from "./chat-assistant";
import { aiRoutes } from "./routes";

// AI: models by name through the AI SDK, Platform admin → Models, members' conversations with streaming chat, assistants
// and the chat widget. Knowledge bases are optional (the knowledge module).
export const aiModule = defineModule({
  id: "ai",
  apiGroup: { name: "AI", description: "Models by name, conversations, streaming chat, assistants and the chat widget." },
  dependsOn: ["integrations", "settings"],
  settings: [
    { id: "ai", label: "Models: the default, and the app's own model names", schema: aiSettingsSchema, scopes: ["app"] },
    {
      id: CHAT_ASSISTANT,
      label: "The widget the app's chat uses (ADR 0031). Choose it from a widget's page.",
      schema: chatAssistantSchema,
      scopes: ["app", "organization"],
    },
  ],
  roleGroups: [{ id: "ai", label: "AI" }],
  permissions: [
    {
      id: "ai",
      label: "AI chat",
      group: "ai",
      actions: [
        { id: "chat", label: "Chat with the app's models", tier: "view" },
        { id: "history", label: "See everyone's conversations", tier: "manage" },
        { id: "configure", label: "Create and change assistants", tier: "manage" },
      ],
    },
  ],
  setup: (ctx) => ({ routes: aiRoutes(ctx) }),
});
