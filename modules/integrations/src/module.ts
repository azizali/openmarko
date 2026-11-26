import { defineModule, type AppContext } from "@app/kernel";
import { integrationRoutes } from "./routes";
import { pruneOriginals } from "./originals";

// Integrations: Connections, encrypted credentials and invoke(), which every module calls to reach a provider.
// Routes: Settings → Integrations (list, connect, disconnect), the app's own Connections (Platform admin → Connections),
// and signed provider webhooks. Job: integrations.prune-originals (daily) drops kept provider responses past their
// time (PROVIDER_ORIGINALS_DAYS).
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
  setup: (ctx: AppContext) => ({
    routes: integrationRoutes(ctx),
    jobs: [{ name: "integrations.prune-originals", cron: "45 3 * * *", run: async () => void (await pruneOriginals(ctx)) }],
  }),
});
