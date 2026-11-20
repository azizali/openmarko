import { defineModule } from "@app/kernel";
import { setEnabledModules } from "./status";
import { featureRoutes } from "./routes";

export const featuresModule = defineModule({
  id: "features",
  apiGroup: { name: "Features", description: "Feature switches for an organization, and what each one needs." },
  setup: (ctx) => {
    setEnabledModules(ctx.cfg.enabledModules);
    return { routes: featureRoutes(ctx) };
  },
});
