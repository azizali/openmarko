// SEO (/seo): the overview and one page per check, for one Location at a time. The Location comes from `?location=`,
// else the one last opened in this Organization, else the first; a switcher shows only when there's more than one.
// With no Location yet, SEO starts with setup (/seo/setup). Each page lives in its own file beside this one.
import { createContext, lazy, use, useEffect, useMemo, type ReactNode } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { MapPin } from "lucide-react";
import { PageHeader, Select } from "../../components/ui";
import { LoadError } from "../../components/Feedback";
import { useLoad } from "../../lib/useLoad";
import { useOrg, useSession } from "../../lib/session";
import { seoApi, type LocationView } from "./api";

const pages = {
  overview: lazy(() => import("./Overview")),
  maps: lazy(() => import("./Maps")),
  keywords: lazy(() => import("./Keywords")),
  ai: lazy(() => import("./Ai")),
  competitors: lazy(() => import("./Competitors")),
  settings: lazy(() => import("./Settings")),
};
export type SeoTab = keyof typeof pages;

/** The page names, as the sidebar and headers read them. */
export const tabNames: Record<SeoTab, string> = {
  overview: "SEO",
  maps: "Google Maps ranking",
  keywords: "Keywords",
  ai: "AI answers",
  competitors: "Competitors",
  settings: "SEO settings",
};

type SeoContextValue = {
  orgId: string;
  location: LocationView;
  locations: LocationView[];
  /** Reloads the Locations (after a change to one). */
  reload: () => Promise<void>;
  can: (action: "view" | "track" | "publish" | "manage") => boolean;
};
const SeoContext = createContext<SeoContextValue | null>(null);

export function useSeo(): SeoContextValue {
  const v = use(SeoContext);
  if (!v) throw new Error("useSeo needs the SEO page around it.");
  return v;
}

const rememberKey = (orgId: string) => `seo-location-${orgId}`;
function remembered(orgId: string): string | null {
  try {
    return localStorage.getItem(rememberKey(orgId));
  } catch {
    return null;
  }
}
function remember(orgId: string, id: string) {
  try {
    localStorage.setItem(rememberKey(orgId), id);
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
  }
}

export default function Seo() {
  const org = useOrg();
  const { can } = useSession();
  const { tab } = useParams();
  const [params] = useSearchParams();
  const locations = useLoad(() => seoApi(org.id).locations.get(), [org.id]);
  const list = useMemo(() => (locations.data ?? []).filter((l) => l.status !== "draft"), [locations.data]);
  const asked = params.get("location") ?? remembered(org.id);
  const location = list.find((l) => l.id === asked) ?? list[0];

  useEffect(() => {
    if (location) remember(org.id, location.id);
  }, [org.id, location]);

  const page = (tab && tab in pages ? tab : "overview") as SeoTab;
  if (locations.error) return <LoadError what="SEO">{locations.error}</LoadError>;
  if (!locations.data) return null;
  // Nothing launched yet: a draft goes back to where setup left off.
  if (!location) {
    const draft = locations.data.find((l) => l.status === "draft");
    return <Navigate replace to={draft ? `/seo/setup?location=${draft.id}` : "/seo/setup"} />;
  }
  const Page = pages[page];
  const value: SeoContextValue = {
    orgId: org.id,
    location,
    locations: list,
    reload: locations.reload,
    can: (action) => can("seo", action),
  };
  return (
    <SeoContext value={value}>
      {/* A tab name that isn't a page lands on the overview. */}
      {tab && !(tab in pages) ? <Navigate replace to="/seo" /> : <Page />}
    </SeoContext>
  );
}

/** The switcher between Locations, shown in a page's header when there's more than one. */
export function LocationSwitcher() {
  const { location, locations } = useSeo();
  const [, setParams] = useSearchParams();
  if (locations.length < 2) return null;
  return (
    <label className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <MapPin size={14} aria-hidden />
      <span className="sr-only">Location</span>
      <Select
        size="sm"
        value={location.id}
        onChange={(e) =>
          setParams(
            (p) => {
              p.set("location", e.target.value);
              return p;
            },
            { replace: true },
          )
        }
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

/** A page's header: its name, one line on what it answers, the Location switcher, and its own actions. */
export function SeoHeader({ tab, sub, actions }: { tab: SeoTab; sub: string; actions?: ReactNode }) {
  return (
    <PageHeader
      title={tabNames[tab]}
      sub={sub}
      actions={
        <>
          <LocationSwitcher />
          {actions}
        </>
      }
    />
  );
}

/** Goes to another SEO page, keeping the Location. */
export function useSeoNavigate() {
  const navigate = useNavigate();
  const { location } = useSeo();
  return (to: string) => navigate(`${to}${to.includes("?") ? "&" : "?"}location=${location.id}`);
}
