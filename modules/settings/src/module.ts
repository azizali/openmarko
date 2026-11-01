import { defineModule } from "@openmarko/kernel";

// Settings are storage only. Each module registers the namespaces it owns (registerSetting) and
// reads or writes them through the functions in service.ts. No routes here: a module exposes its own.
export const settingsModule = defineModule({
  id: "settings",
  setup: () => ({}),
});
