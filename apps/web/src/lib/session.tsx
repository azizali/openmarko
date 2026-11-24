// Who is signed in, the Organizations they belong to, the one they're working in, and what their Role allows there.
// Loaded once, kept in context; pages read it with useSession() and useOrg().
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { authClient } from "./auth";
import { loadBrand } from "./brand";
import { modules } from "./modules";
import { useTasksChanged } from "./tasksChanged";

export type Me = { id: string; email: string; name: string; emailVerified: boolean };
export type Membership = {
  id: string;
  name: string;
  slug: string;
  role: string;
  archivedAt: Date | null | string;
  partnerId: string | null;
};
export type Partner = { id: string; name: string };
export type Caller = { userId: string; orgId: string; role: string; permission: Record<string, string[]> };

type Session = {
  loading: boolean;
  me: Me | null;
  admin: boolean;
  organizations: Membership[];
  /** The Organization being worked in. */
  org: Membership | null;
  caller: Caller | null;
  /** The Partners this person works at, whichever Organization is open. */
  partners: Partner[];
  /** The open Organization when it's a Partner this person works at. Null anywhere else, its Clients included. */
  partner: Partner | null;
  /** The Organization's feature switches: { id: { on } }. */
  features: Record<string, { on: boolean }>;
  /** Reloads the switches after a change, so the sidebar and pages follow. */
  reloadFeatures: () => Promise<void>;
  switchOrg: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Whether the Role allows `action` on `resource` in the current Organization. */
  can: (resource: string, action: string) => boolean;
};

const Ctx = createContext<Session | null>(null);
const ORG_KEY = "app-org";

/** The Organization this browser last worked in, if any. */
export function rememberedOrg(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [admin, setAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<Membership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [caller, setCaller] = useState<Caller | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [features, setFeatures] = useState<Record<string, { on: boolean }>>({});

  const refresh = useCallback(async () => {
    const { data } = await api.api.v1.me.get();
    if (!data || !data.signedIn) {
      setMe(null);
      setAdmin(false);
      setOrganizations([]);
      setPartners([]);
      setOrgId(null);
      setCaller(null);
      setLoading(false);
      return;
    }
    setMe(data.user);
    setAdmin(data.admin);
    const orgs = (await api.api.v1.me.organizations.get()).data ?? [];
    const live = orgs.filter((o) => !o.archivedAt);
    setOrganizations(live as Membership[]);
    setPartners(modules.partners ? ((await api.api.v1.me.partners.get()).data ?? []) : []);
    const remembered = rememberedOrg();
    const pick = live.find((o) => o.id === remembered) ?? live.find((o) => o.id === data.activeOrganizationId) ?? live[0] ?? null;
    setOrgId(pick?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  // A Task applied from the chat may have changed what the session shows (the Organization's name, say).
  useTasksChanged((applied) => {
    if (applied) void refresh();
  });

  // The Role in the current Organization, from the API: what the sidebar and pages show follows it.
  const loadCaller = useCallback(async (id: string | null) => {
    const data = id ? ((await api.api.v1.organizations({ orgId: id }).caller.get()).data as Caller | null) : null;
    setCaller(data ?? null);
  }, []);
  useEffect(() => {
    void loadCaller(orgId);
  }, [orgId, loadCaller]);

  const loadFeatures = useCallback(async (id: string | null) => {
    const data = id ? (await api.api.v1.organizations({ orgId: id }).features.get()).data : null;
    setFeatures((data as Record<string, { on: boolean }>) ?? {});
  }, []);
  useEffect(() => {
    void loadFeatures(orgId);
  }, [orgId, loadFeatures]);
  const reloadFeatures = useCallback(() => loadFeatures(orgId), [orgId, loadFeatures]);

  // The brand follows the Organization. Not while loading: main.tsx has already applied the remembered one's.
  useEffect(() => {
    if (!loading) void loadBrand(orgId);
  }, [loading, orgId]);

  const switchOrg = useCallback(async (id: string) => {
    try {
      localStorage.setItem(ORG_KEY, id);
    } catch {
      // storage blocked: this tab only
    }
    setOrgId(id);
    await authClient.organization.setActive({ organizationId: id });
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    try {
      localStorage.removeItem(ORG_KEY);
    } catch {
      // nothing to forget
    }
    await refresh();
  }, [refresh]);

  const org = useMemo(() => organizations.find((o) => o.id === orgId) ?? null, [organizations, orgId]);
  const can = useCallback((resource: string, action: string) => !!caller?.permission[resource]?.includes(action), [caller]);

  const partner = useMemo(() => partners.find((a) => a.id === orgId) ?? null, [partners, orgId]);

  return (
    <Ctx.Provider
      value={{
        loading,
        me,
        admin,
        organizations,
        org,
        caller,
        partners,
        partner,
        features,
        reloadFeatures,
        switchOrg,
        refresh,
        signOut,
        can,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

/** The current Organization; pages inside the app shell always have one. */
export function useOrg(): Membership {
  const { org } = useSession();
  if (!org) throw new Error("No organization selected");
  return org;
}
