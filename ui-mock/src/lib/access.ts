// The people on the Organization, its custom roles, the Partner's staff, and
// what the signed-in Member may do. Every check in the app goes through `can`
// (or `useCan` / <Can>), so a role change shows everywhere at once.
//
// Partner staff: a Partner Admin is an Admin on every Client automatically.
// A Partner Member sees only the Clients they're assigned, with a role chosen
// per Client. Real build: Better Auth member rows on each Client, kept in step
// by organization hooks (a new Client adds the Partner's Admins; assigning or
// unassigning adds or removes the row).
//
// Mock: one store for every Organization, kept in localStorage. Real build: per
// Organization (members, invitations and organizationRole tables).

import { useSyncExternalStore } from "react";
import { allows, allowsAll, compile, presets, reach, resources, type Permission, type Resource, type RoleSpec } from "../data/access";
import { partner } from "../data/partner";
import { featureForPage } from "./features";

export type Person = { id: string; name: string; email: string; roleId: string; invited?: boolean };
export type Staff = { id: string; name: string; email: string; partnerRole: "Admin" | "Member"; /** Client Organization → role, for Partner Members. */ clients: Record<string, string> };

type State = { people: Person[]; roles: RoleSpec[]; staff: Staff[]; me: string; preview: string | null };
const KEY = "gw-access";
const seed: State = {
  people: [
    { id: "p_anika", name: "Dr. Anika Patel", email: "anika@mapleandmaindental.com", roleId: "owner" },
    { id: "p_sam", name: "Sam Ortiz", email: "sam@mapleandmaindental.com", roleId: "editor" },
    { id: "p_jess", name: "Jess Lin", email: "frontdesk@mapleandmaindental.com", roleId: "r_frontdesk" },
    { id: "p_priya", name: "Priya Shah", email: "priya@studioshah.co", roleId: "r_social", invited: true },
  ],
  roles: [
    { id: "r_social", name: "Social media manager", description: "Runs social end to end. Sees SEO, nothing else.", base: "none", groups: { social: "publish", seo: "view", marko: "view" }, resources: { brand: "view" } },
    { id: "r_frontdesk", name: "Front desk", description: "Answers customers and drafts review replies for someone to post.", base: "none", groups: { customers: "publish", marko: "view" }, resources: { reviews: ["view", "reply"], seo: "view", email: "view", sms: "view", campaigns: "view" } },
  ],
  staff: partner ? [
    { id: "s_jordan", name: "Jordan Reyes", email: "jordan@brightlinelocal.com", partnerRole: "Admin", clients: {} },
    { id: "s_casey", name: "Casey Nguyen", email: "casey@brightlinelocal.com", partnerRole: "Member", clients: { org_maple: "editor", org_hill: "viewer" } },
  ] : [],
  me: "p_anika",
  preview: null,
};
let state: State = (() => { try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); return s ? { ...seed, ...s, preview: null } : seed; } catch { return seed; } })();
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  try { const { preview: _, ...keep } = state; localStorage.setItem(KEY, JSON.stringify(keep)); } catch {}
  listeners.forEach((l) => l());
};
export const useAccess = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);

export const allRoles = (s: State = state) => [...presets, ...s.roles];
export const roleById = (id: string, s: State = state) => allRoles(s).find((r) => r.id === id) ?? presets[presets.length - 1];

// ---------- Checks ----------

let cache: { key: string; perm: Permission } | null = null;
/** The signed-in Member's permission, or the previewed role's. */
export function myPermission(s: State = state): Permission {
  const role = roleById(s.preview ?? s.people.find((p) => p.id === s.me)?.roleId ?? "viewer", s);
  const key = JSON.stringify(role);
  if (cache?.key !== key) cache = { key, perm: compile(role) };
  return cache.perm;
}
export const myRole = (s: State = state) => roleById(s.preview ?? s.people.find((p) => p.id === s.me)?.roleId ?? "viewer", s);
export const can = (r: Resource, action: string, s: State = state) => allows(myPermission(s), r, action);
export const useCan = (r: Resource, action: string) => can(r, action, useAccess());
/** Better Auth's shape: hasPermission({ permissions: { reviews: ["post"] } }). */
export const hasPermission = ({ permissions }: { permissions: Permission }) => allowsAll(myPermission(), permissions);
/** Seen but not changeable: the role stops at View on something that has more to do. */
export const viewOnly = (r: Resource, s: State = state) => reach(myPermission(s), r) === "view" && resources[r].some((a) => a.tier !== "view");

/** Whether the page behind a link may be opened. Pages without a feature (Home, Reports, Todo) are open to everyone. */
export function pageAllowed(to: string, s: State = state) {
  const [p, q] = to.split("?");
  const id = featureForPage(p, q ? `?${q}` : "");
  return !id || can(id, id === "marko" ? "use" : "view", s);
}

// ---------- People ----------

export const invite = (email: string, roleId: string) => {
  const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  set({ people: [...state.people, { id: `p_${Date.now().toString(36)}`, name, email, roleId, invited: true }] });
};
export const setPersonRole = (id: string, roleId: string) => set({ people: state.people.map((p) => (p.id === id ? { ...p, roleId } : p)) });
export const removePerson = (id: string) => set({ people: state.people.filter((p) => p.id !== id) });
export const peopleWithRole = (roleId: string, s: State = state) => s.people.filter((p) => p.roleId === roleId).length;

// ---------- Roles ----------

export function saveRole(spec: RoleSpec) {
  const exists = state.roles.some((r) => r.id === spec.id);
  set({ roles: exists ? state.roles.map((r) => (r.id === spec.id ? spec : r)) : [...state.roles, spec] });
}
/** Deleting a role moves its people to `fallback`, so nobody is left without one. */
export function deleteRole(id: string, fallback = "viewer") {
  set({ roles: state.roles.filter((r) => r.id !== id), people: state.people.map((p) => (p.roleId === id ? { ...p, roleId: fallback } : p)), staff: state.staff.map((x) => ({ ...x, clients: Object.fromEntries(Object.entries(x.clients).map(([o, r]) => [o, r === id ? fallback : r])) })) });
}
export const setPreview = (roleId: string | null) => set({ preview: roleId });
/** While previewing, the app acts as that role on this Organization, so Partner-only pages are hidden too. */
export const previewing = (s: State = state) => s.preview !== null;
/** How many actions a role allows, for the role list. */
export const actionCount = (spec: RoleSpec) => Object.values(compile(spec)).reduce((n, a) => n + a.length, 0);

// ---------- Partner staff ----------

export const setStaff = (id: string, patch: Partial<Staff>) => set({ staff: state.staff.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
export const inviteStaff = (email: string, partnerRole: Staff["partnerRole"]) => {
  const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  set({ staff: [...state.staff, { id: `s_${Date.now().toString(36)}`, name, email, partnerRole, clients: {} }] });
};
export const removeStaff = (id: string) => set({ staff: state.staff.filter((x) => x.id !== id) });
/** Partner staff who can open this Organization, with the role they get on it. */
export const staffOn = (orgId: string, s: State = state) =>
  s.staff.flatMap((x) => (x.partnerRole === "Admin" ? [{ staff: x, roleId: "admin" }] : x.clients[orgId] ? [{ staff: x, roleId: x.clients[orgId] }] : []));
