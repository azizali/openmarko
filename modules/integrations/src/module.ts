import { defineModule, type AppContext } from "@app/kernel";
import { integrationRoutes } from "./routes";

// Integrations: Connections, encrypted credentials and invoke(), which every module calls to reach a provider.
// Routes: Settings → Integrations (list, connect, disconnect), the app's own Connections (Platform admin → Connections),
// and signed provider webhooks.
export const integrationsModule = defineModule({
  id: "integrations",
  apiGroup: {
    name: "Integrations",
    description: "Connections to providers (Settings → Integrations), the app's own accounts, and signed provider webhooks.",
  },
  dependsOn: ["organizations"],
  events: [
    { id: "connection.created", label: "A provider was connected" },
    { id: "connection.revoked", label: "A provider was disconnected" },
  ],
  setup: (ctx: AppContext) => ({ routes: integrationRoutes(ctx) }),
});
