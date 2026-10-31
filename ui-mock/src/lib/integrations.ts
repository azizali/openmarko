// Connections: every connected provider as one list, whatever it is and
// wherever it's attached. Features ask "what powers email.send here?" and
// Settings → Integrations shows and manages all of them.
//
// Mock: the stores that already hold connection state (crm for email and
// texting, ads, outreach, setup for Google profiles and social accounts) stay
// the source, and this reads them into one shape and routes connect and
// disconnect back to them. Website tools, Slack and extra social accounts live
// in a small store here. Real build: one connections table
// { id, provider, attach, targetId, account, credentialsRef, status, createdAt },
// with credentials in a vault and the rest of each store's state on the feature.

import { useMemo, useSyncExternalStore } from "react";
import { capabilityOf, permissionsFor, providerOf, type Attach, type CapabilityId, type Provider, type ProviderId } from "../data/integrations";
import { locations } from "../data/mock";
import { shortLocation, websites } from "../data/org";
import { partner } from "../data/partner";
import { accounts, type SocialPlatform } from "../data/social";
import { toolOf, type ToolId } from "../data/ads";
import { disconnectTool, useAds } from "./ads";
import { disconnectEmail, disconnectPhone, useCrm } from "./crm";
import { disconnect as disconnectSequencer, useOutreach } from "./outreach";
import { accountConnected, setAccount, setGoogleProfile, useSetup } from "./setup";
import { can } from "./access";
import { product } from "./whitelabel";

export type Target = { kind: Attach; id: string; label: string };
export type Status = "ok" | "action" | "pending";
export type Connection = { id: string; provider: ProviderId; target: Target; account: string; status: Status; note?: string; since?: number };

const org: Target = { kind: "organization", id: "org", label: "Organization" };
const partnerTarget = (): Target => (partner ? { kind: "partner", id: partner.id, label: partner.name } : { kind: "partner", id: "me", label: "You" });
export const locationTarget = (id: string): Target => ({ kind: "location", id, label: shortLocation(id) || id });
export const websiteTarget = (id: string): Target => ({ kind: "website", id, label: websites.find((w) => w.id === id)?.domain ?? id });
/** Every place a provider attaching to `kind` could go. */
export const targetsOf = (kind: Attach): Target[] =>
  kind === "location" ? locations.map((l) => locationTarget(l.id)) : kind === "website" ? websites.map((w) => websiteTarget(w.id)) : kind === "partner" ? [partnerTarget()] : [org];

/** Managed providers are ours, so they carry the product name (whitelabel). */
export const providerName = (x: Provider) => (x.id === "managed_email" ? `${product()} sending` : x.id === "managed_phone" ? `${product()} numbers` : x.name);

// ---------- Own store: website tools, Slack, extra social accounts ----------

type Extra = Omit<Connection, "status"> & { status?: Status };
const KEY = "gw-integrations";
const websiteTool: Record<string, ProviderId> = { "Search Console": "search_console", "Google Analytics 4": "ga4", WordPress: "wordpress" };
const seed: Extra[] = websites.flatMap((w) => w.tools.filter((t) => t.connected).map((t) => ({ id: `${websiteTool[t.name]}:${w.id}`, provider: websiteTool[t.name], target: websiteTarget(w.id), account: t.detail })));
let extras: Extra[] = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null") ?? seed; } catch { return seed; } })();
const listeners = new Set<() => void>();
const setExtras = (next: Extra[]) => { extras = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} listeners.forEach((l) => l()); };
const useExtras = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => extras, () => extras);

// ---------- Reading ----------

const adProvider: Partial<Record<ToolId, ProviderId>> = { meta: "meta_ads", google: "google_ads", tiktok: "tiktok_ads", pixel: "meta_pixel" };
const toolFor = (p: ProviderId) => (Object.entries(adProvider).find(([, v]) => v === p)?.[0] ?? p) as ToolId;
const adProviders = new Set<ProviderId>(["meta_ads", "google_ads", "tiktok_ads", "meta_pixel", "gads_conv", "callrail", "booking", "creatomate", "canva", "foreplay"]);

export function useConnections(): Connection[] {
  const crm = useCrm();
  const ads = useAds();
  const outreach = useOutreach();
  const setup = useSetup();
  const own = useExtras();
  return useMemo(() => {
    const out: Connection[] = [];
    const { email, sms } = crm.channels;
    if (email.provider) out.push({ id: "email", provider: email.provider === "managed" ? "managed_email" : email.provider, target: org, account: email.fromAddress || email.domain, status: email.verified ? "ok" : "action", note: email.verified ? undefined : "Waiting for DNS" });
    if (sms.provider) out.push({ id: "phone", provider: sms.provider === "managed" ? "managed_phone" : sms.provider, target: org, account: sms.numbers.length ? `${sms.numbers.length} number${sms.numbers.length === 1 ? "" : "s"}` : "No numbers yet", status: sms.campaign === "approved" ? "ok" : "pending", note: sms.campaign === "approved" ? undefined : "Carrier registration in progress" });
    const c = outreach.connection;
    if (c) out.push({ id: "sequencer", provider: c.provider, target: partnerTarget(), account: c.workspace, status: "ok", since: c.connectedAt });
    for (const [id, at] of Object.entries(ads.connected)) if (at) out.push({ id: `ads:${id}`, provider: adProvider[id as ToolId] ?? (id as ProviderId), target: org, account: toolOf(id as ToolId).account, status: "ok", since: at as number });
    for (const l of locations) if (setup.googleProfile[l.id]) out.push({ id: `gbp:${l.id}`, provider: "gbp", target: locationTarget(l.id), account: l.address, status: "ok" });
    for (const a of accounts) if (a.platform !== "google" && accountConnected(a.id, setup)) out.push({ id: `social:${a.id}`, provider: a.platform as ProviderId, target: org, account: a.handle, status: "ok", note: a.locationId ? `Speaks for ${shortLocation(a.locationId)}` : undefined });
    for (const x of own) if (x.target.kind !== "website" || setup.website[x.target.id]) out.push({ status: "ok", ...x });
    return out;
  }, [crm.channels, ads.connected, outreach.connection, setup, own]);
}

export const connectionsOf = (list: Connection[], p: ProviderId) => list.filter((c) => c.provider === p);
/** What serves a capability, optionally at one place. */
export const servingOf = (list: Connection[], cap: CapabilityId, target?: Target) =>
  list.filter((c) => providerOf(c.provider).capabilities.includes(cap) && (!target || (c.target.kind === target.kind && c.target.id === target.id)));

/**
 * Connections that connecting `p` at `target` would replace: others serving a
 * "one" capability of `p` at the same place.
 */
export function replaces(list: Connection[], p: Provider, target: Target) {
  const ones = p.capabilities.filter((c) => capabilityOf(c).max === "one");
  return list.filter((c) => c.provider !== p.id && c.target.kind === target.kind && c.target.id === target.id && ones.some((cap) => providerOf(c.provider).capabilities.includes(cap)));
}

/** Places `p` can still be connected: for "one per place" providers, the places that don't have it yet. */
export function openTargets(list: Connection[], p: Provider) {
  const all = targetsOf(p.attach);
  const manyHere = p.capabilities.some((c) => capabilityOf(c).max === "many");
  return manyHere ? all : all.filter((t) => !list.some((c) => c.provider === p.id && c.target.kind === t.kind && c.target.id === t.id));
}

/** Follows what it powers: the role needs every capability's connect permission. */
export const canConnect = (p: Provider) => permissionsFor(p).every(([r, a]) => can(r, a));
/** For the hub's "Needs" line: the first missing permission, as text. */
export const missingPermission = (p: Provider) => permissionsFor(p).find(([r, a]) => !can(r, a));

// ---------- Changing ----------

/** How the app connects a provider: the setup flows that already exist, or the generic one. */
export type Flow = "email" | "phone" | "sequencer" | "ad_tool" | "generic";
export const flowOf = (p: Provider): Flow =>
  p.category === "Email" ? "email" : p.category === "Texting & calls" ? "phone" : p.category === "Cold outreach" ? "sequencer" : adProviders.has(p.id) ? "ad_tool" : "generic";
export const adToolOf = (p: ProviderId) => toolOf(toolFor(p));

/** The generic flow's last step. Social and Google profiles go to the stores features read. */
export function connectGeneric(p: Provider, target: Target, account: string) {
  if (p.id === "gbp") return setGoogleProfile(target.id, true);
  const existing = accounts.find((a) => a.platform === (p.id as SocialPlatform) && !a.connected);
  if (existing && p.category === "Social") return setAccount(existing.id, true);
  setExtras([...extras.filter((x) => !(x.provider === p.id && x.target.id === target.id && p.capabilities.every((c) => capabilityOf(c).max === "one"))), { id: `${p.id}:${target.id}:${Date.now().toString(36)}`, provider: p.id, target, account, since: Date.now() }]);
}

export function disconnectConnection(c: Connection) {
  if (c.id === "email") return disconnectEmail();
  if (c.id === "phone") return disconnectPhone();
  if (c.id === "sequencer") return disconnectSequencer();
  if (c.id.startsWith("ads:")) return disconnectTool(c.id.slice(4) as ToolId);
  if (c.id.startsWith("gbp:")) return setGoogleProfile(c.target.id, false);
  if (c.id.startsWith("social:")) return setAccount(c.id.slice(7), false);
  setExtras(extras.filter((x) => x.id !== c.id));
}

// ---------- Which drawer or flow is open, from anywhere ----------

type Open = { manage?: ProviderId; connect?: { provider: ProviderId; target?: Target } };
let open: Open = {};
const openListeners = new Set<() => void>();
const setOpen = (o: Open) => { open = o; openListeners.forEach((l) => l()); };
export const useOpenIntegration = () => useSyncExternalStore((l) => { openListeners.add(l); return () => { openListeners.delete(l); }; }, () => open, () => open);
export const manageProvider = (id: ProviderId) => setOpen({ manage: id });
export const connectProvider = (id: ProviderId, target?: Target) => setOpen({ connect: { provider: id, target } });
export const closeIntegration = () => setOpen({});
