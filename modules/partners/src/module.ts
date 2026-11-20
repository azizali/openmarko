import { defineModule } from "@app/kernel";
import { brandSchema } from "./brand";
import { partnerRoutes } from "./routes";

// Partners (ADR 0004, ADR 0011, ADR 0023): businesses that manage Client Organizations under their own brand.
// Optional: without this module these routes don't exist, and Organizations have no Partners.
export const partnersModule = defineModule({
  id: "partners",
  apiGroup: { name: "Partners", description: "Partners and their Clients, whitelabel brands, transfer-out." },
  dependsOn: ["organizations", "settings"],
  events: [
    { id: "partner.client_added", label: "A Partner created a Client" },
    { id: "partner.client_removed", label: "A Partner and a Client parted" },
  ],
  settings: [{ id: "whitelabel", label: "A Partner's brand, shown to its Clients", schema: brandSchema, scopes: ["partner"] }],
  setup: (ctx) => ({ routes: partnerRoutes(ctx) }),
});
