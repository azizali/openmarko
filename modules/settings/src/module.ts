import { defineModule } from "@app/kernel";
import { settingsRoutes } from "./routes";

// Settings are storage: each module declares the namespaces it owns in its manifest (`settings`) and reads or writes
// them through readSetting and writeSetting. The routes here are the Admin area's view of the app-wide settings:
// each `app`-scope namespace the enabled modules declare, as a form built from its schema.
export const settingsModule = defineModule({
  id: "settings",
  apiGroup: { name: "Settings", description: "The app's settings, as forms from each module's schema (admin)." },
  setup: (ctx) => ({ routes: settingsRoutes(ctx) }),
});
