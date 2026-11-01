import { defineModule, type AppContext } from "@openmarko/kernel";
import { integrationRoutes } from "./routes";

// Integrations: Connections, encrypted credentials and invoke(), which every module calls to reach a provider.
// Routes: Settings → Integrations (list, connect, disconnect), the platform default LLM (admin), and signed
// provider webhooks. Google Business Profiles connect through the seo module, which links them to a Location.
export const integrationsModule = defineModule({
  id: "integrations",
  dependsOn: ["billing", "organizations"],
  setup: (ctx: AppContext) => ({ routes: integrationRoutes(ctx) }),
});
