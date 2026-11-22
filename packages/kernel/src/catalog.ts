// What the app's modules offer, gathered from their manifests.
// Each module declares its API key scopes, events and settings in its own defineModule; everything that lists them
// (key issuance, settings and Roles now; the console, webhooks, Plans and API docs as they arrive) reads this catalog,
// so adding a module changes none of those by hand.
import { z, type ZodType } from "zod";
import type { ModuleDefinition } from "./module";

/** `resource.what_happened`, e.g. `location.created`. */
export const EVENT_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/** A permission resource, an action on one, or a Role editor group: `reviews`, `post`, `organization`. */
export const RESOURCE_PATTERN = /^[a-z][a-z0-9_]*$/;
/** A settings namespace, e.g. `whitelabel` or `llm.routes`. */
export const SETTING_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

/** One entry a module declares: its id and a sentence a person reads in the console or docs. */
export type Declared = { id: string; label: string };
export type CatalogEntry = Declared & { module: string };

/** Where a setting can be set: for the whole app, an Organization, a Partner (an Organization, for its Clients) or a user. */
export type SettingScope = "app" | "organization" | "partner" | "user";
/** The scope id every app-wide setting is stored under. */
export const APP_SCOPE_ID = "app";
/**
 * A settings namespace a module owns: one JSON record per scope, checked against `schema` on every write and read.
 * Changing the schema needs no migration: give new fields defaults, and a stored value that no longer fits reads as unset.
 */
export type DeclaredSetting = Declared & { schema: ZodType; scopes: SettingScope[] };
export type SettingEntry = DeclaredSetting & { module: string };

/**
 * How far an action reaches, lowest first: view → edit (draft, change) → publish (goes live, sends, spends) →
 * manage (connect, delete, admin). A Role gives a level, and a level includes every action at or below it.
 */
export type Tier = "view" | "edit" | "publish" | "manage";
export const TIERS: Tier[] = ["view", "edit", "publish", "manage"];
/** One thing a Member may do on a resource. `ownerOnly`: only the Owner Role ever gets it. */
export type DeclaredAction = Declared & { tier: Tier; ownerOnly?: boolean };
/**
 * A permission resource a module's routes check, with its actions. `group` is the Role
 * editor row it sits in: a group some module in the catalog declares.
 */
export type DeclaredResource = Declared & { group: string; actions: DeclaredAction[] };
export type ResourceEntry = DeclaredResource & { module: string };

export type Catalog = {
  /** Every module in the catalog, by id. */
  modules: string[];
  /** What each module needs enabled with it (its manifest's dependsOn). */
  dependencies: Record<string, string[]>;
  events: CatalogEntry[];
  settings: SettingEntry[];
  /** Permission resources: what Roles are built from, and Better Auth's statement. */
  resources: ResourceEntry[];
  /** Role editor groups, in declaration order. */
  groups: CatalogEntry[];
};

/** What Roles are compiled against: the enabled modules' resources and groups. */
export type AccessCatalog = Pick<Catalog, "resources" | "groups">;

/**
 * Builds the catalog and checks it: ids are well formed and no two modules declare the same one.
 * Throws at boot, so a bad manifest never reaches a request.
 */
export function buildCatalog(modules: ModuleDefinition[]): Catalog {
  const problems: string[] = [];
  const gather = <K extends "events" | "settings" | "permissions" | "roleGroups">(kind: K, pattern: RegExp, example: string) => {
    type Entry = NonNullable<ModuleDefinition[K]>[number] & { module: string };
    const seen = new Map<string, string>();
    const out: Entry[] = [];
    for (const m of modules)
      for (const d of m[kind] ?? []) {
        if (!pattern.test(d.id)) problems.push(`${m.id}: ${kind} "${d.id}" isn't like ${example}`);
        const owner = seen.get(d.id);
        if (owner) problems.push(`${kind} "${d.id}" is declared by both ${owner} and ${m.id}`);
        seen.set(d.id, m.id);
        out.push({ ...d, module: m.id } as Entry);
      }
    return out;
  };
  const catalog: Catalog = {
    modules: modules.map((m) => m.id),
    dependencies: Object.fromEntries(modules.map((m) => [m.id, m.dependsOn ?? []])),
    events: gather("events", EVENT_PATTERN, "location.created"),
    settings: gather("settings", SETTING_PATTERN, "whitelabel"),
    resources: gather("permissions", RESOURCE_PATTERN, "reviews"),
    groups: gather("roleGroups", RESOURCE_PATTERN, "organization"),
  };
  const groupIds = new Set(catalog.groups.map((g) => g.id));
  for (const r of catalog.resources) {
    if (!groupIds.has(r.group)) problems.push(`${r.module}: resource "${r.id}" is in group "${r.group}", which no module declares`);
    if (!r.actions.length) problems.push(`${r.module}: resource "${r.id}" has no actions`);
    const seen = new Set<string>();
    for (const a of r.actions) {
      if (!RESOURCE_PATTERN.test(a.id)) problems.push(`${r.module}: action "${r.id}.${a.id}" isn't like post`);
      if (!TIERS.includes(a.tier)) problems.push(`${r.module}: action "${r.id}.${a.id}" has an unknown tier "${a.tier}"`);
      if (seen.has(a.id)) problems.push(`${r.module}: action "${r.id}.${a.id}" is declared twice`);
      seen.add(a.id);
    }
  }
  for (const s of catalog.settings) if (!s.scopes.length) problems.push(`${s.module}: setting "${s.id}" names no scope`);
  if (problems.length) throw new Error(`Module manifests are invalid:\n  ${problems.join("\n  ")}`);
  return catalog;
}

/** The catalog as JSON, for the platform admin area and docs: each setting's schema becomes a JSON Schema. */
export function describeCatalog(catalog: Catalog) {
  return {
    ...catalog,
    settings: catalog.settings.map(({ schema, ...s }) => ({ ...s, schema: z.toJSONSchema(schema, { io: "input" }) })),
  };
}
