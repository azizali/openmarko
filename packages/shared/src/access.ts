// Pure, so the web app's Role editor imports it as `@app/shared/access` (the package's barrel also holds server code).
//
// Who can do what (ADR 0003). Each module declares, in its manifest, the permission resources
// its routes check and their actions, and each action sits at a level:
//   view → edit (draft, change) → publish (goes live, sends, spends) → manage (connect, delete, admin)
// The app's Roles are built from the resources of the modules it has switched on: its AccessCatalog (`caller.access`).
// A Role says a level per group, optionally a different level (or a hand-picked list of actions) per resource,
// and a level for everything else. Roles compile to a plain { resource: actions[] } permission, so checks stay
// fine-grained while editing a Role stays a handful of clicks, and a new module's resources pick up their group's
// level in every Role without touching any of them.
//
// Better Auth gets its statement from the catalog (identity/auth.ts):
//   const ac = createAccessControl(statementOf(access));
//   organization({ ac, roles: presetRoles(access), dynamicAccessControl: { enabled: true } })
// Custom Roles are Better Auth dynamic roles with the spec saved beside them (an additional field on
// organizationRole), so the editor can reopen it and the grant recompiles against the app's current catalog.
// `member`, `invitation`, `team`, `ac` and `organization` are Better Auth's own resources with its action names
// (declared by the identity module), so its built-in endpoints are guarded by the same Roles.

import type { AccessCatalog, ResourceEntry, Tier } from "@app/kernel";

export type { AccessCatalog, Tier };
export type Level = "none" | Tier;
export const levels: Level[] = ["none", "view", "edit", "publish", "manage"];
export const levelLabel: Record<Level, string> = { none: "None", view: "View", edit: "Edit", publish: "Publish", manage: "Full" };
export const levelHint: Record<Level, string> = {
  none: "Hidden",
  view: "See it, change nothing",
  edit: "Draft and change, nothing goes out",
  publish: "Also post, send and spend",
  manage: "Also connect, delete and export",
};
const rank = (l: Level) => levels.indexOf(l);

/** A permission resource id, as a module's manifest declares it (`reviews`, `organization`). */
export type Resource = string;
export type Permission = Record<Resource, string[]>;

/** Better Auth's statement for the app: every resource it has and that resource's actions. */
export const statementOf = (access: AccessCatalog): Record<Resource, string[]> =>
  Object.fromEntries(access.resources.map((r) => [r.id, r.actions.map((a) => a.id)]));

export type RoleSpec = {
  id: string;
  name: string;
  description: string;
  /** Built in: the same in every Organization, can't be edited or deleted. */
  preset?: boolean;
  /** Level for anything without its own. */
  base: Level;
  /** Levels per Role editor group. Groups the app doesn't have are ignored. */
  groups: Partial<Record<string, Level>>;
  /** A level, or exactly these actions. Resources the app doesn't have are ignored. */
  resources: Partial<Record<Resource, Level | string[]>>;
};

/** What a Role gives on one resource: its own setting, else its group's, else the base. */
export const settingFor = (spec: RoleSpec, r: Pick<ResourceEntry, "id" | "group">): Level | string[] =>
  spec.resources[r.id] ?? spec.groups[r.group] ?? spec.base;

export function actionsFor(spec: RoleSpec, r: ResourceEntry): string[] {
  if (spec.id === "owner") return r.actions.map((a) => a.id);
  const s = settingFor(spec, r);
  const allowed = r.actions.filter((a) => !a.ownerOnly);
  return Array.isArray(s)
    ? allowed.filter((a) => s.includes(a.id)).map((a) => a.id)
    : allowed.filter((a) => rank(a.tier) <= rank(s)).map((a) => a.id);
}

/** The Role as Better Auth stores it. Resources with nothing allowed are left out. */
export function compile(access: AccessCatalog, spec: RoleSpec): Permission {
  const out: Permission = {};
  for (const r of access.resources) {
    const a = actionsFor(spec, r);
    if (a.length) out[r.id] = a;
  }
  return out;
}

export const allows = (p: Permission, r: Resource, action: string) => !!p[r]?.includes(action);
/** Better Auth's hasPermission semantics: every listed action on every listed resource. */
export const allowsAll = (p: Permission, want: Permission) =>
  Object.entries(want).every(([r, acts]) => acts!.every((a) => allows(p, r, a)));
/** The highest level a resource reaches in a permission, for "can edit anything here?" questions. */
export const reach = (access: AccessCatalog, p: Permission, r: Resource): Level =>
  (access.resources.find((x) => x.id === r)?.actions ?? []).reduce<Level>(
    (top, a) => (allows(p, r, a.id) && rank(a.tier) > rank(top) ? a.tier : top),
    "none",
  );

/** The built-in Roles every Organization has. Names they use that the app lacks (a module switched off) are ignored. */
export const presets: RoleSpec[] = [
  {
    id: "owner",
    name: "Owner",
    description: "Everything, including billing, ownership and deleting the organization.",
    preset: true,
    base: "manage",
    groups: {},
    resources: {},
  },
  {
    id: "admin",
    name: "Admin",
    description: "Everything except billing and deleting the organization.",
    preset: true,
    base: "manage",
    groups: {},
    resources: {},
  },
  {
    id: "editor",
    name: "Editor",
    description: "Works on everything and publishes. Can't connect accounts, manage people or change settings.",
    preset: true,
    base: "publish",
    groups: { organization: "view" },
    resources: { billing: "none" },
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Sees everything, changes nothing.",
    preset: true,
    base: "view",
    groups: {},
    resources: { billing: "none", ac: "none" },
  },
];

/** The preset Roles compiled against the app's catalog. */
export const presetPermissions = (access: AccessCatalog): Record<string, Permission> =>
  Object.fromEntries(presets.map((p) => [p.id, compile(access, p)]));
