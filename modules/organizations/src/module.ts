import { defineModule } from "@app/kernel";
import { organizationRoutes } from "./routes";

export const organizationsModule = defineModule({
  id: "organizations",
  apiGroup: { name: "Organizations", description: "Organizations, members and invitations; the Admin area's list." },
  dependsOn: ["identity", "access", "features"],
  permissions: [
    {
      id: "setup",
      label: "Integrations",
      group: "organization",
      actions: [
        { id: "view", label: "See integrations and features", tier: "view" },
        { id: "connect", label: "Connect and disconnect providers", tier: "manage" },
      ],
    },
  ],
  events: [
    { id: "organization.archived", label: "An Organization was archived" },
    { id: "organization.unarchived", label: "An archived Organization was restored" },
    { id: "organization.deleted", label: "An Organization was deleted" },
  ],
  setup: (ctx) => ({ routes: organizationRoutes(ctx) }),
});
