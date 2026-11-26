// Search (/seo, the SEO module): the overview, then Rankings (one page per check, and competitors) and Actions (the
// Action plan, and the Site audit with its Key pages that feed it), for one Location at a time. Rankings and Actions are one sidebar entry
// each; their pages are tabs across the top of each other (SectionTabs), and a deep page has breadcrumbs instead. A page may have deeper pages under it
// (/seo/maps/<keyword>, /seo/site-audit/<issue>), read from the rest of the path by the page itself. The Location comes from `?location=`,
// else the one last opened in this Organization, else the first; a switcher shows only when there's more than one.
// With no Location yet, SEO starts with setup (/seo/setup). Each page lives in its own file beside this one.
import { createContext, lazy, use, useEffect, useMemo, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronRight, MapPin } from "lucide-react";
import { PageHeader, Select, cn, type Crumb } from "../../components/ui";
import { LoadError } from "../../components/Feedback";
import { useLoad } from "../../lib/useLoad";
import { useOrg, useSession } from "../../lib/session";
import { locationApi, seoApi, type LocationView } from "./api";
import { CheckLine, CheckNowButton, ChecksProvider, kindsOf, useAfterCheck } from "./checks";

const pages = {
  overview: lazy(() => import("./Overview")),
  maps: lazy(() => import("./Maps")),
  keywords: lazy(() => import("./Keywords")),
  ai: lazy(() => import("./Ai")),
  competitors: lazy(() => import("./Competitors")),
  plan: lazy(() => import("./Plan")),
  "site-audit": lazy(() => import("./SiteAudit")),
  settings: lazy(() => import("./Settings")),
};
export type SeoTab = keyof typeof pages;

/** The page names, as the sidebar and headers read them. */
export const tabNames: Record<SeoTab, string> = {
  overview: "Search",
  maps: "Google Maps ranking",
  keywords: "Google search ranking",
  ai: "AI answers",
  competitors: "Competitors",
  plan: "Action plan",
  "site-audit": "Site audit",
  settings: "Search settings",
};

/** Rankings and Actions: each a sidebar entry whose pages are tabs, in this order. */
const sections: { label: string; tabs: { tab: SeoTab; label: string }[] }[] = [
  {
    label: "Rankings",
    tabs: [
      { tab: "maps", label: "Google Maps" },
      { tab: "keywords", label: "Google search" },
      { tab: "ai", label: "AI answers" },
      { tab: "competitors", label: "Competitors" },
    ],
  },
  {
    label: "Actions",
    tabs: [
      { tab: "plan", label: "Action plan" },
      { tab: "site-audit", label: "Site audit" },
    ],
  },
];

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
  // Stable between renders, so pages can depend on it (and on `can`) in effects.
  const reload = locations.reload;
  const value = useMemo<SeoContextValue | null>(
    () =>
      location
        ? {
            orgId: org.id,
            location,
            locations: list,
            reload,
            can: (action) => can("seo", action),
          }
        : null,
    [org.id, location, list, reload, can],
  );

  const known = !!tab && Object.hasOwn(pages, tab);
  const page = (known ? tab : "overview") as SeoTab;
  if (locations.error) return <LoadError what="SEO">{locations.error}</LoadError>;
  if (!locations.data) return null;
  // Nothing launched yet: a draft goes back to where setup left off.
  if (!location || !value) {
    const draft = locations.data.find((l) => l.status === "draft");
    return <Navigate replace to={draft ? `/seo/setup?location=${draft.id}` : "/seo/setup"} />;
  }
  const Page = pages[page];
  return (
    <SeoContext value={value}>
      {/* A tab name that isn't a page lands on the overview. */}
      {tab && !known ? (
        <Navigate replace to="/seo" />
      ) : (
        <ChecksProvider>
          <Page />
        </ChecksProvider>
      )}
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

/**
 * A page's header. On a Rankings or Actions page it's the section's: its name, the Location switcher, the page's own
 * buttons and Check now, then its tabs as the header's lower edge, then the page's own line under them: the list page's one fact, or for a
 * deep page (one keyword, one issue) its name and its line; its tab stays selected and is the way back to the list,
 * and a page further down (a business seen on a keyword) has the steps between, "dentist ›", above its name. The overview and settings have a plain header.
 * Check now's caption says when the data was last checked (checks.tsx). `trail` is the steps below the tab, ending
 * with this page.
 */
export function SeoHeader({
  tab,
  title,
  trail,
  sub,
  actions,
  suggestions,
  switcher = true,
}: {
  tab: SeoTab;
  title?: ReactNode;
  /** The steps between the section and this page, ending with this page. */
  trail?: Crumb[];
  sub: ReactNode;
  actions?: ReactNode;
  /** The check whose open actions a link after `sub` counts, opening them on the Action plan. Shown only when there are some. */
  suggestions?: "maps" | "keywords" | "ai";
  /** False where the page lists the Locations itself (settings), so there's one way to choose, not two. */
  switcher?: boolean;
}) {
  const href = useSeoHref();
  const line = suggestions ? (
    <>
      {sub}
      <SuggestionsLink helps={suggestions} />
    </>
  ) : (
    sub
  );
  const section = sections.find((x) => x.tabs.some((t) => t.tab === tab));
  if (!section)
    return (
      <PageHeader
        title={title ?? tabNames[tab]}
        sub={line}
        actions={
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {switcher && <LocationSwitcher />}
              {actions}
              <CheckNowButton tab={tab} />
            </div>
            <CheckLine tab={tab} className="sm:justify-end" />
          </div>
        }
      />
    );

  const deep = !!trail;
  // The way back up from a page two or more levels down: the steps between its tab and it. The selected tab is the way
  // back to the list itself, so it isn't repeated.
  const back: Crumb[] = deep ? trail.slice(0, -1) : [];
  return (
    <div className="mb-7">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <h1 className="font-serif text-[34px] leading-[1.1] tracking-[-0.02em]">{section.label}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {switcher && <LocationSwitcher />}
          {actions}
          <CheckNowButton tab={tab} />
        </div>
      </div>
      <nav aria-label={section.label} className="mt-5 flex gap-6 overflow-x-auto border-b border-line">
        {section.tabs.map((t) => (
          <Link
            key={t.tab}
            to={href(`/seo/${t.tab}`)}
            aria-current={t.tab === tab ? (deep ? "location" : "page") : undefined}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-[14px] whitespace-nowrap transition-colors",
              t.tab === tab ? "border-ink font-medium text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className={cn("mt-4 flex flex-wrap justify-between gap-x-6 gap-y-2", deep ? "items-end" : "items-baseline")}>
        <div className="min-w-0 flex-1 basis-[20rem]">
          {back.length > 0 && (
            <nav aria-label="Back" className="mb-1.5 flex flex-wrap items-center gap-1 text-[13px] text-muted">
              {back.map((c, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1">
                  {c.to ? (
                    <Link to={c.to} className="truncate underline-offset-2 hover:text-fg hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="truncate">{c.label}</span>
                  )}
                  <ChevronRight size={13} className="shrink-0 text-subtle" aria-hidden />
                </span>
              ))}
            </nav>
          )}
          {deep && <h2 className="text-[22px] leading-snug font-medium tracking-[-0.01em] text-balance">{title}</h2>}
          {line && <p className={cn("max-w-2xl text-[14px] text-muted", deep && "mt-1")}>{line}</p>}
        </div>
        <CheckLine tab={tab} className="sm:justify-end" />
      </div>
    </div>
  );
}

/**
 * " · 3 actions ›" after a check page's line: how many open actions would move this check, opening them on the Action
 * plan with its filter set. It sits in the line, not among the buttons, and says nothing when there are none.
 */
function SuggestionsLink({ helps }: { helps: "maps" | "keywords" | "ai" }) {
  const { orgId, location } = useSeo();
  const href = useSeoHref();
  const open = useLoad(() => locationApi(orgId, location.id).suggestions.get(), [orgId, location.id]);
  // Suggestions are written once a check cycle ends, so the count follows any check finishing.
  useAfterCheck(kindsOf.overview, open.reload);
  const count = open.data?.open.filter((s) => s.helpsAll.includes(helps)).length ?? 0;
  if (!count) return null;
  return (
    <>
      {" · "}
      <Link to={href(`/seo/plan?helps=${helps}`)} className="inline-flex items-center gap-0.5 text-fg underline-offset-2 hover:underline">
        {count} {count === 1 ? "action" : "actions"}
        <ChevronRight size={13} aria-hidden />
      </Link>
    </>
  );
}

/** A link to another SEO page that keeps the Location: `href("/seo/maps/abc")` → `/seo/maps/abc?location=…`. */
export function useSeoHref() {
  const { location } = useSeo();
  return (to: string) => `${to}${to.includes("?") ? "&" : "?"}location=${location.id}`;
}

/** Goes to another SEO page, keeping the Location. */
export function useSeoNavigate() {
  const navigate = useNavigate();
  const { location } = useSeo();
  return (to: string) => navigate(`${to}${to.includes("?") ? "&" : "?"}location=${location.id}`);
}
