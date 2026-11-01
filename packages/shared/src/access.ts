// Who can do what. Every feature (data/features.ts) and every Organization
// area declares its own actions, and each action sits at a level:
//   view → edit (draft, change) → publish (goes live, sends, spends) → manage (connect, delete, admin)
// A role says a level per module, optionally a different level (or a hand-picked
// list of actions) per feature, and a level for everything else. Roles compile
// to a plain { resource: actions[] } permission, so checks stay fine-grained
// while editing a role stays a handful of clicks, and a new feature picks up
// its module's level in every role without touching any of them.
//
// Better Auth: this file has no React or app imports, so the server can import
// it as-is.
//   const ac = createAccessControl(statement);
//   organization({ ac, roles: Object.fromEntries(presets.map((p) => [p.id, ac.newRole(compile(p))])),
//                  dynamicAccessControl: { enabled: true } })
// Custom roles are Better Auth dynamic roles: createRole({ role, permission: compile(spec) }),
// with the spec saved beside it (an additional field on organizationRole) so
// the editor can reopen it and so roles recompile when features are added.
// Checks: auth.api.hasPermission({ headers, body: { permissions: { reviews: ["post"] } } }).
// `member`, `invitation`, `team`, `ac` and `organization` are Better Auth's own
// resources with its action names, so its built-in endpoints are guarded by the same roles.

import type { FeatureId } from "./features";

export type Tier = "view" | "edit" | "publish" | "manage";
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

export type Action = { id: string; label: string; tier: Tier; /** Only the Owner ever gets it. */ ownerOnly?: boolean };
const act = (id: string, label: string, tier: Tier, ownerOnly?: boolean): Action => ({
  id,
  label,
  tier,
  ...(ownerOnly ? { ownerOnly } : {}),
});
const view = (label: string) => act("view", label, "view");

// `satisfies` makes a FeatureId without actions a type error.
const featureActions = {
  seo: [
    view("See Business Profile and the SEO overview"),
    act("edit", "Edit Business Profile details", "edit"),
    act("publish", "Publish profile changes and Google posts", "publish"),
    act("connect", "Connect Google Business Profiles", "manage"),
  ],
  rankings: [
    view("See rankings, competitors and keywords"),
    act("edit", "Add keywords and competitors", "edit"),
    act("scan", "Run grid scans", "edit"),
  ],
  ai_answers: [view("See AI answers"), act("edit", "Track questions", "edit")],
  reviews: [
    view("Read reviews"),
    act("reply", "Draft replies", "edit"),
    act("post", "Post replies", "publish"),
    act("request", "Send review requests", "publish"),
  ],
  content: [view("Read articles"), act("edit", "Write and edit articles", "edit"), act("publish", "Publish to the website", "publish")],
  citations: [view("See citations and backlinks"), act("submit", "Submit and fix listings", "publish")],
  site_health: [view("See site issues"), act("fix", "Apply fixes to the website", "publish")],
  social: [view("See the social overview"), act("connect", "Connect social accounts", "publish")],
  social_scanner: [view("See trends and watched profiles"), act("edit", "Watch and unwatch profiles", "edit")],
  social_swipe: [view("See the swipe file"), act("edit", "Save and organise ideas", "edit")],
  social_posts: [view("See the calendar"), act("edit", "Draft and schedule posts", "edit"), act("publish", "Publish posts", "publish")],
  ads: [
    view("See campaigns and results"),
    act("edit", "Draft campaigns and targeting", "edit"),
    act("publish", "Launch, pause and change budgets", "publish"),
    act("connect", "Connect ad accounts and set the goal", "manage"),
  ],
  ad_research: [view("See competitors' ads"), act("edit", "Save ads", "edit")],
  ad_studio: [view("See creatives"), act("edit", "Make creatives", "edit"), act("publish", "Publish creatives", "publish")],
  customers: [
    view("See contacts"),
    act("edit", "Add, edit and import contacts", "edit"),
    act("export", "Export contacts", "manage"),
    act("delete", "Delete contacts", "manage"),
  ],
  email: [view("See email setup"), act("connect", "Set up the sending domain", "manage")],
  sms: [view("See texting setup"), act("connect", "Buy numbers and register for texting", "manage")],
  inbox: [view("Read conversations"), act("assign", "Assign and label", "edit"), act("reply", "Reply to customers", "publish")],
  campaigns: [view("See campaigns"), act("edit", "Draft campaigns", "edit"), act("send", "Send campaigns", "publish")],
  workflows: [view("See workflows"), act("edit", "Build workflows", "edit"), act("activate", "Turn workflows on and off", "publish")],
  sales: [
    view("See prospects and audits"),
    act("edit", "Find and audit businesses", "edit"),
    act("share", "Share audit links", "publish"),
    act("export", "Export prospects", "manage"),
  ],
  outreach: [
    view("See outreach and replies"),
    act("send", "Send prospects to the sequencer", "publish"),
    act("connect", "Connect the sequencer", "manage"),
  ],
  marko: [act("use", "Chat with the assistant", "view")],
} satisfies Record<FeatureId, Action[]>;

const orgActions = {
  brand: [view("See brand voice, business facts and skills"), act("edit", "Change brand voice, facts and skills", "edit")],
  setup: [view("See locations, websites, accounts and integrations"), act("connect", "Add, connect and disconnect them", "manage")],
  autopilot: [view("See autopilot and schedules"), act("edit", "Change what runs on its own", "manage")],
  activity: [view("See the activity log")],
  member: [
    act("create", "Add people", "manage"),
    act("update", "Change people's roles", "manage"),
    act("delete", "Remove people", "manage"),
  ],
  invitation: [act("create", "Send invites", "manage"), act("cancel", "Cancel invites", "manage")],
  ac: [
    act("read", "See roles", "view"),
    act("create", "Create roles", "manage"),
    act("update", "Edit roles", "manage"),
    act("delete", "Delete roles", "manage"),
  ],
  team: [act("create", "Create teams", "manage"), act("update", "Edit teams", "manage"), act("delete", "Delete teams", "manage")],
  organization: [
    act("update", "Change organization settings and features", "manage"),
    act("delete", "Delete the organization", "manage", true),
  ],
  billing: [view("See plan and invoices"), act("update", "Change plan and payment", "manage", true)],
};

export const resources: Record<Resource, Action[]> = { ...featureActions, ...orgActions };
export type Resource = keyof typeof featureActions | keyof typeof orgActions;
export type Permission = Partial<Record<Resource, string[]>>;

/** Better Auth's statement: every resource and its actions. */
export const statement = Object.fromEntries(Object.entries(resources).map(([r, acts]) => [r, acts.map((a) => a.id)])) as Record<
  Resource,
  string[]
>;

/** How the role editor lays resources out: one row per group, a row per resource inside. */
export type GroupId = "seo" | "social" | "ads" | "customers" | "sales" | "marko" | "organization";
export const groups: { id: GroupId; label: string; resources: { id: Resource; label: string }[] }[] = [
  {
    id: "seo",
    label: "Local SEO",
    resources: [
      { id: "seo", label: "Business Profile" },
      { id: "rankings", label: "Rankings & competitors" },
      { id: "ai_answers", label: "AI answers" },
      { id: "reviews", label: "Reviews" },
      { id: "content", label: "Articles" },
      { id: "citations", label: "Citations & backlinks" },
      { id: "site_health", label: "Site health" },
    ],
  },
  {
    id: "social",
    label: "Social media",
    resources: [
      { id: "social", label: "Overview" },
      { id: "social_scanner", label: "Social scanner" },
      { id: "social_swipe", label: "Swipe file" },
      { id: "social_posts", label: "Posts & calendar" },
    ],
  },
  {
    id: "ads",
    label: "Ads",
    resources: [
      { id: "ads", label: "Campaigns" },
      { id: "ad_research", label: "Ad research" },
      { id: "ad_studio", label: "Creative studio" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    resources: [
      { id: "customers", label: "Contacts" },
      { id: "inbox", label: "Inbox" },
      { id: "campaigns", label: "Campaigns" },
      { id: "workflows", label: "Workflows" },
      { id: "email", label: "Email" },
      { id: "sms", label: "Texting" },
    ],
  },
  {
    id: "sales",
    label: "Prospecting",
    resources: [
      { id: "sales", label: "Prospects & audits" },
      { id: "outreach", label: "Outreach" },
    ],
  },
  { id: "marko", label: "Assistant", resources: [{ id: "marko", label: "Assistant" }] },
  {
    id: "organization",
    label: "Organization",
    resources: [
      { id: "brand", label: "Brand voice & skills" },
      { id: "setup", label: "Locations, websites & accounts" },
      { id: "autopilot", label: "Autopilot & schedules" },
      { id: "activity", label: "Activity" },
      { id: "member", label: "People" },
      { id: "invitation", label: "Invites" },
      { id: "ac", label: "Roles" },
      { id: "organization", label: "Organization settings" },
      { id: "billing", label: "Billing" },
    ],
  },
];
// Better Auth's sub-teams aren't used yet; `team` stays in the statement but out of the editor.
export const groupOf = (r: Resource): GroupId => groups.find((g) => g.resources.some((x) => x.id === r))?.id ?? "organization";

export type RoleSpec = {
  id: string;
  name: string;
  description: string;
  /** Built in: the same in every Organization, can't be edited or deleted. */
  preset?: boolean;
  /** Level for anything without its own. */
  base: Level;
  groups: Partial<Record<GroupId, Level>>;
  /** A level, or exactly these actions. */
  resources: Partial<Record<Resource, Level | string[]>>;
};

/** What a role gives on one resource: its own setting, else its group's, else the base. */
export const settingFor = (spec: RoleSpec, r: Resource): Level | string[] => spec.resources[r] ?? spec.groups[groupOf(r)] ?? spec.base;

export function actionsFor(spec: RoleSpec, r: Resource): string[] {
  if (spec.id === "owner") return resources[r].map((a) => a.id);
  const s = settingFor(spec, r);
  const allowed = resources[r].filter((a) => !a.ownerOnly);
  return Array.isArray(s)
    ? allowed.filter((a) => s.includes(a.id)).map((a) => a.id)
    : allowed.filter((a) => rank(a.tier) <= rank(s)).map((a) => a.id);
}

/** The role as Better Auth stores it. Resources with nothing allowed are left out. */
export function compile(spec: RoleSpec): Permission {
  const out: Permission = {};
  for (const r of Object.keys(resources) as Resource[]) {
    const a = actionsFor(spec, r);
    if (a.length) out[r] = a;
  }
  return out;
}

export const allows = (p: Permission, r: Resource, action: string) => !!p[r]?.includes(action);
/** Better Auth's hasPermission semantics: every listed action on every listed resource. */
export const allowsAll = (p: Permission, want: Permission) =>
  Object.entries(want).every(([r, acts]) => acts!.every((a) => allows(p, r as Resource, a)));
/** The highest level a resource reaches in a permission, for "can edit anything here?" questions. */
export const reach = (p: Permission, r: Resource): Level =>
  resources[r].reduce<Level>((top, a) => (allows(p, r, a.id) && rank(a.tier) > rank(top) ? a.tier : top), "none");

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
    resources: { brand: "edit", billing: "none" },
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
