import { defineModule } from "@app/kernel";
import { identityRoutes } from "./routes";

export const identityModule = defineModule({
  id: "identity",
  apiGroup: { name: "Identity", description: "Who you are, sign-in methods, and the app's users (admin)." },
  // Better Auth's own resources, with its action names, so its built-in endpoints are guarded by the same Roles.
  roleGroups: [{ id: "organization", label: "Organization" }],
  permissions: [
    {
      id: "member",
      label: "People",
      group: "organization",
      actions: [
        { id: "create", label: "Add people", tier: "manage" },
        { id: "update", label: "Change people's roles", tier: "manage" },
        { id: "delete", label: "Remove people", tier: "manage" },
      ],
    },
    {
      id: "invitation",
      label: "Invites",
      group: "organization",
      actions: [
        { id: "create", label: "Send invites", tier: "manage" },
        { id: "cancel", label: "Cancel invites", tier: "manage" },
      ],
    },
    {
      id: "ac",
      label: "Roles",
      group: "organization",
      actions: [
        { id: "read", label: "See roles", tier: "view" },
        { id: "create", label: "Create roles", tier: "manage" },
        { id: "update", label: "Edit roles", tier: "manage" },
        { id: "delete", label: "Delete roles", tier: "manage" },
      ],
    },
    {
      // Better Auth's sub-teams aren't used yet; the resource stays so its endpoints are guarded.
      id: "team",
      label: "Teams",
      group: "organization",
      actions: [
        { id: "create", label: "Create teams", tier: "manage" },
        { id: "update", label: "Edit teams", tier: "manage" },
        { id: "delete", label: "Delete teams", tier: "manage" },
      ],
    },
    {
      id: "organization",
      label: "Organization settings",
      group: "organization",
      actions: [
        { id: "update", label: "Change organization settings and features", tier: "manage" },
        { id: "delete", label: "Delete the organization", tier: "manage", ownerOnly: true },
      ],
    },
  ],
  setup: (ctx) => ({ routes: identityRoutes(ctx) }),
});
