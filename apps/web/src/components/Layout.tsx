// The app shell: a sidebar with the Organization switcher and the pages the enabled modules add, a command palette
// (⌘K), the theme toggle, and the page area. Pages a Role can't see, or a module that's off, never show.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import {
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  ChevronsUpDown,
  CornerDownLeft,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { Avatar, cn, ModalDialog, navRow } from "./ui";
import { Logo } from "./Logo";
import { useTheme } from "../lib/theme";
import { useSession, type Membership } from "../lib/session";
import { modules } from "../lib/modules";
import { useBrand } from "../lib/brand";

// The floating chat widget and what the sidebar's Sparkles button opens. Folds away with the ai module (vite.config.ts).
const AppChat = __MODULE_AI__ ? lazy(() => import("./AppChat")) : null;

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type NavGroupInfo = { label: string; icon: Icon };
const aiGroup: NavGroupInfo = { label: "AI", icon: Bot };
export type NavItem = {
  /** The feature switch (app.config.ts) that shows or hides this entry. */
  feature?: string;
  to: string;
  label: string;
  icon: Icon;
  /** Listed under this expandable parent in the sidebar. */
  group?: NavGroupInfo;
  /** Sits at the foot of the sidebar with the account, apart from the pages. */
  foot?: boolean;
  when?: (can: (r: string, a: string) => boolean) => boolean;
};

/** Every page in the app. Optional modules add theirs only when the build has them. */
export const nav: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutGrid },
  ...(modules.automation
    ? [
        {
          to: "/automation",
          label: "Automation",
          icon: ListChecks,
          feature: "automation",
          when: (can) => can("activity", "view"),
        } satisfies NavItem,
      ]
    : []),
  // One group: a Widget answers from the Knowledge bases attached to it.
  ...(modules.ai
    ? [
        {
          to: "/widgets",
          label: "Widgets",
          icon: MessagesSquare,
          group: aiGroup,
          feature: "assistant",
          when: (can) => can("ai", "configure"),
        } satisfies NavItem,
      ]
    : []),
  ...(modules.knowledge
    ? [
        {
          to: "/knowledge",
          label: "Knowledge base",
          icon: BookOpen,
          group: aiGroup,
          feature: "knowledge",
          when: (can) => can("knowledge", "view"),
        } satisfies NavItem,
      ]
    : []),
  { to: "/settings", label: "Settings", icon: Settings, foot: true },
];

const iconBtn =
  "grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg pointer-coarse:size-9";
const onPath = (path: string, to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`));

const groupKey = (label: string) => `nav-group-${label}`;
function storedOpen(label: string) {
  try {
    return localStorage.getItem(groupKey(label)) !== "closed";
  } catch {
    return true; // storage blocked: expanded, the default
  }
}

function SidebarLink({ item, path }: { item: NavItem; path: string }) {
  return (
    <Link to={item.to} aria-current={onPath(path, item.to) ? "page" : undefined} className={navRow(onPath(path, item.to))}>
      <item.icon size={15} strokeWidth={1.75} className="shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

/** A parent row that expands to its pages. It remembers being collapsed, and opens when you arrive on one of its pages. */
function NavGroup({ info, items, path }: { info: NavGroupInfo; items: NavItem[]; path: string }) {
  const [open, setOpen] = useState(() => storedOpen(info.label));
  const here = items.some((n) => onPath(path, n.to));
  useEffect(() => {
    if (here) setOpen(true);
  }, [here]);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(groupKey(info.label), open ? "closed" : "open");
    } catch {
      // storage blocked: it just won't be remembered
    }
  };
  return (
    <div>
      {/* While collapsed, the parent stands in for the page you're on. */}
      <button type="button" onClick={toggle} aria-expanded={open} className={cn(navRow(here && !open), "w-full text-left")}>
        <info.icon size={15} strokeWidth={1.75} className="shrink-0" />
        <span className="flex-1 truncate">{info.label}</span>
        <ChevronRight size={13} className={cn("shrink-0 text-subtle transition-transform duration-200", open && "rotate-90")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="mt-px ml-[15px] flex flex-col gap-px border-l border-line pl-2">
            {items.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-current={onPath(path, n.to) ? "page" : undefined}
                className={cn(navRow(onPath(path, n.to)), "focus-visible:-outline-offset-2")}
              >
                <span className="flex-1 truncate">{n.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrgSwitcher() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { organizations, org, partners, switchOrg, me } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  const initial = (org?.name ?? me?.name ?? "?").charAt(0).toUpperCase();
  const isPartner = (o: Membership) => partners.some((a) => a.id === o.id);
  const isClient = (o: Membership) => partners.some((a) => a.id === o.partnerId);
  const kind = org ? (isPartner(org) ? "Partner" : isClient(org) ? "Client" : null) : (me?.email ?? null);
  const others = organizations.filter((o) => !isPartner(o) && !isClient(o));
  const groups = [
    { label: "Partner", orgs: organizations.filter(isPartner) },
    { label: "Clients", orgs: organizations.filter(isClient) },
    { label: others.length > 1 ? "Organizations" : "Organization", orgs: others },
  ].filter((g) => g.orgs.length > 0);
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-hover"
        aria-expanded={open}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-[13px] font-semibold text-on-ink">{initial}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium">{org?.name ?? "No organization"}</span>
          {kind && <span className="block truncate text-[12px] text-muted">{kind}</span>}
        </span>
        <ChevronsUpDown size={14} className="text-subtle" />
      </button>
      {open && (
        <div className="anim-fade absolute top-full right-0 left-0 z-30 mt-1 rounded-lg border border-line bg-surface p-1 shadow-float">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">{g.label}</div>
              {g.orgs.map((o) => (
                <div key={o.id} className="flex items-center rounded hover:bg-hover">
                  <button
                    onClick={() => {
                      void switchOrg(o.id);
                      setOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-[13px]"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded bg-hover text-[11px] font-semibold">
                      {o.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    {o.id === org?.id && <Check size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      void switchOrg(o.id);
                      setOpen(false);
                      void navigate("/settings/general");
                    }}
                    aria-label={`Settings for ${o.name}`}
                    title="Settings"
                    className="mr-1 grid size-6 shrink-0 place-items-center rounded text-subtle hover:bg-active hover:text-fg"
                  >
                    <Settings size={14} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          ))}
          <div className="my-1 border-t border-line" />
          <NavLink
            to="/onboarding"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] text-muted hover:bg-hover"
          >
            <Plus size={13} /> New organization
          </NavLink>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ onClose, items }: { onClose: () => void; items: NavItem[] }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const { admin, partner } = useSession();
  const found = useMemo(() => {
    const pages = [
      ...items.map((i) => ({ label: i.label, hint: "Page", to: i.to })),
      ...[
        "general",
        "features",
        "integrations",
        "team",
        ...(modules.billing ? ["billing"] : []),
        ...(partner ? ["clients", "whitelabel"] : []),
        "profile",
        "appearance",
      ].map((s) => ({
        label: `Settings · ${s[0]!.toUpperCase()}${s.slice(1)}`,
        hint: "Settings",
        to: `/settings/${s}`,
      })),
      ...(admin ? [{ label: "Admin", hint: "Settings", to: "/settings/admin-users" }] : []),
      { label: "New organization", hint: "Setup", to: "/onboarding" },
    ];
    return pages.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  }, [q, items, admin, partner]);
  const go = (to: string) => {
    navigate(to);
    onClose();
  };
  return (
    <ModalDialog
      onClose={onClose}
      label="Command menu"
      className="anim-fade fixed inset-x-0 top-[14vh] mx-auto h-fit w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-xl border border-line shadow-float"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search size={16} className="text-subtle" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(found.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && found[idx]) go(found[idx]!.to);
          }}
          placeholder="Go to…"
          aria-label="Search"
          className="h-12 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-subtle"
        />
      </div>
      <ul className="max-h-80 overflow-y-auto p-1.5">
        {found.map((it, i) => (
          <li key={it.to + it.label}>
            <button
              onMouseEnter={() => setIdx(i)}
              onClick={() => go(it.to)}
              className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13.5px]", i === idx && "bg-hover")}
            >
              {it.label.startsWith("New ") && <Plus size={13} className="shrink-0 text-subtle" />}
              <span className="flex-1 truncate">{it.label}</span>
              <span className="text-[12px] text-subtle">{it.hint}</span>
              {i === idx && <CornerDownLeft size={13} className="text-subtle" />}
            </button>
          </li>
        ))}
        {!found.length && <li className="px-3 py-6 text-center text-[13px] text-muted">No results for “{q}”</li>}
      </ul>
    </ModalDialog>
  );
}

export default function Layout() {
  const [dark, setDark] = useTheme();
  const [cmd, setCmd] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const loc = useLocation();
  const { loading, me, org, organizations, can, signOut, features } = useSession();
  const brand = useBrand();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (loading) return null;
  if (!me) return <Navigate to="/sign-in" replace state={{ from: loc.pathname }} />;
  if (!org) return <Navigate to="/onboarding" replace />;

  // A feature that's off hides its menu entry, and its page says so (Settings → Features turns it back on).
  const switched = (n: NavItem) => !n.feature || features[n.feature]?.on !== false;
  const items = nav.filter((n) => (!n.when || n.when(can)) && switched(n));
  const offHere = nav.find((n) => n.feature && onPath(loc.pathname, n.to) && !switched(n));
  // Everyone who may chat has the widget, as long as the Organization has the assistant switched on.
  const hasChat = modules.ai && can("ai", "chat") && features.assistant?.on !== false;
  const chatButton = hasChat && !onPath(loc.pathname, "/widgets");

  const pages = items.filter((n) => !n.foot);
  const foot = items.filter((n) => n.foot);
  const sidebar = (
    <div className="flex h-full flex-col gap-1 px-2.5 py-2.5">
      <div className="flex h-8 items-center gap-0.5">
        <NavLink to="/" aria-label={`${brand.name} home`} className="mr-auto flex h-7 items-center rounded-md px-2 hover:bg-hover">
          <Logo size={17} />
        </NavLink>
        {hasChat && (
          <button
            onClick={() => {
              setChatOpen(!chatOpen);
              setMobileNav(false);
            }}
            aria-label={brand.assistant}
            aria-pressed={chatOpen}
            title={brand.assistant}
            className={iconBtn}
          >
            <Sparkles size={15} strokeWidth={1.75} />
          </button>
        )}
        <button onClick={() => setCmd(true)} aria-label="Search" title="Search (⌘K)" className={iconBtn}>
          <Search size={15} strokeWidth={1.75} />
        </button>
      </div>
      <OrgSwitcher />
      <nav className="mt-1 flex flex-1 flex-col gap-px overflow-y-auto" aria-label="Main">
        {pages.map((n, i) => {
          if (n.group && pages[i - 1]?.group === n.group) return null; // listed with the first of its group
          if (n.group)
            return <NavGroup key={n.group.label} info={n.group} items={pages.filter((p) => p.group === n.group)} path={loc.pathname} />;
          return <SidebarLink key={n.to} item={n} path={loc.pathname} />;
        })}
      </nav>
      <div className="flex flex-col gap-1 border-t border-line pt-2">
        {foot.map((n) => (
          <SidebarLink key={n.to} item={n} path={loc.pathname} />
        ))}
        <div className="flex items-center gap-0.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-0.5">
            <Avatar name={me.name} className="size-7 text-[11px]" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-medium">{me.name}</div>
              <div className="truncate text-[12px] text-muted capitalize" title={`Your role in ${org.name}`}>
                {org.role}
              </div>
            </div>
          </div>
          <button
            onClick={() => setDark(!dark)}
            aria-label={dark ? "Light mode" : "Dark mode"}
            title={dark ? "Light mode" : "Dark mode"}
            className={iconBtn}
          >
            {dark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
          </button>
          <button onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className={iconBtn}>
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sidebar-scope sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-sidebar lg:block print:hidden">
        {sidebar}
      </aside>
      {mobileNav && (
        <ModalDialog
          onClose={() => setMobileNav(false)}
          label="Navigation"
          className="sidebar-scope anim-fade fixed inset-y-0 left-0 h-dvh max-h-none w-64 border-r border-line bg-sidebar lg:hidden"
        >
          <div
            className="h-full"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setMobileNav(false);
            }}
          >
            {sidebar}
          </div>
        </ModalDialog>
      )}
      <div className="relative min-w-0 flex-1">
        <div aria-hidden className="grid-backdrop pointer-events-none absolute inset-x-0 top-0 h-[520px] print:hidden" />
        <div className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden print:hidden">
          <button
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
            className="-ml-1 grid size-9 place-items-center rounded-md hover:bg-hover"
          >
            <Menu size={18} />
          </button>
          <Logo size={20} />
          <button
            onClick={() => setDark(!dark)}
            aria-label={dark ? "Light mode" : "Dark mode"}
            className="-mr-1 ml-auto grid size-9 place-items-center rounded-md hover:bg-hover"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        {/* Room at the bottom so the floating chat button never covers the last row. */}
        <main className={cn("relative mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 lg:px-12 lg:py-10", chatButton && "pb-24 lg:pb-24")}>
          {organizations.length === 0 ? (
            <Navigate to="/onboarding" replace />
          ) : offHere ? (
            <p className="py-16 text-center text-[14px] text-muted">
              {offHere.label} is off for this organization. Turn it on in Settings → Features.
            </p>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      {cmd && <CommandPalette onClose={() => setCmd(false)} items={items} />}
      {AppChat && hasChat && (
        <Suspense fallback={null}>
          {/* No floating button on Widgets: the page has its own widget in the preview, and two would confuse. */}
          <AppChat key={org.id} open={chatOpen} onOpenChange={setChatOpen} launcher={chatButton} />
        </Suspense>
      )}
    </div>
  );
}
