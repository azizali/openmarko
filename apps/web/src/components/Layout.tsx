// The app shell: a sidebar with the Organization switcher and the pages the enabled modules add, a command palette
// (⌘K), the assistant (⌘J), the theme toggle, and the page area. Pages a Role can't see, or a module that's off, never
// show. On wide screens the sidebar narrows to icons (⌘\ or its button) and remembers it.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  ChevronsUpDown,
  CornerDownLeft,
  Gauge,
  LayoutGrid,
  ListChecks,
  ListTodo,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SearchCheck,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { Avatar, cn, ModalDialog, navRow } from "./ui";
import { Logo, LogoMark } from "./Logo";
import { useTheme } from "../lib/theme";
import { platformAdminLabel, roleName } from "@app/shared/access";
import { useSession, type Membership } from "../lib/session";
import { modules } from "../lib/modules";
import { useBrand } from "../lib/brand";

// The floating chat widget and what the sidebar's Sparkles button opens. Folds away with the ai module (vite.config.ts).
const AppChat = __MODULE_AI__ ? lazy(() => import("./AppChat")) : null;

type Icon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;
/**
 * Pages listed together. A group is an expandable parent row by default; a `section` is always open instead, its pages
 * under a small label, for a group that is most of what the app is.
 */
type NavGroupInfo = { label: string; icon: Icon; section?: boolean };
const aiGroup: NavGroupInfo = { label: "AI", icon: Bot };
const seoGroup: NavGroupInfo = {
  label: "Search",
  icon: SearchCheck,
  section: true,
};
export type NavItem = {
  /** The feature switch (app.config.ts) that shows or hides this entry. */
  feature?: string;
  to: string;
  label: string;
  icon: Icon;
  /** Listed under this expandable parent in the sidebar. */
  group?: NavGroupInfo;
  /**
   * The pages this entry stands for, shown as tabs on them (Rankings: Google Maps, Google search…). The entry is the
   * current one on any of them, and each is offered by name in the command palette.
   */
  within?: { to: string; label: string }[];
  /** Sits at the foot of the sidebar with the account, apart from the pages. */
  foot?: boolean;
  when?: (can: (r: string, a: string) => boolean) => boolean;
};

/** Every page in the app. Optional modules add theirs only when the build has them. */
export const nav: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutGrid },
  // Search (the SEO module), for the Location chosen on the page: the overview; Rankings, where you stand and who beats
  // you; Actions, what to change to move them; and its settings. Rankings and Actions are one entry each, their pages
  // tabs on the page (ADR 0037), so the sidebar stays four rows however many tools Actions grows.
  ...(modules.seo
    ? (
        [
          ["/seo/overview", "Overview", Gauge],
          [
            "/seo/maps",
            "Rankings",
            BarChart3,
            [
              ["/seo/maps", "Google Maps"],
              ["/seo/keywords", "Google search"],
              ["/seo/ai", "AI answers"],
              ["/seo/competitors", "Competitors"],
            ],
          ],
          [
            "/seo/plan",
            "Actions",
            ListTodo,
            [
              ["/seo/plan", "Action plan"],
              ["/seo/site-audit", "Site audit"],
            ],
          ],
          ["/seo/settings", "Search settings", Settings],
        ] as const
      ).map(([to, label, icon, within]): NavItem => ({
        to,
        label,
        icon,
        group: seoGroup,
        within: within?.map(([t, l]) => ({ to: t, label: l })),
        feature: "seo",
        when: (can) => can("seo", "view"),
      }))
    : []),
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
/** Whether a sidebar entry is the current one: its own page, or one of the pages it stands for. */
const isHere = (path: string, item: NavItem) => onPath(path, item.to) || !!item.within?.some((w) => onPath(path, w.to));

/** The keyboard shortcuts, written the way this computer's keyboard labels them. */
const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const shortcut = { search: "K", assistant: "J", sidebar: "\\" } as const;
const keys = (key: string) => (mac ? `⌘${key}` : `Ctrl ${key}`);
function Kbd({ k }: { k: string }) {
  return <kbd className="ml-auto shrink-0 rounded border border-line px-1 font-sans text-[11px] leading-[16px] text-subtle">{keys(k)}</kbd>;
}

const narrowKey = "sidebar-narrow";
function storedNarrow() {
  try {
    return localStorage.getItem(narrowKey) === "1";
  } catch {
    return false; // storage blocked: wide, the default
  }
}

/** Whether the wide-screen sidebar shows icons only, remembered on this browser. */
function useNarrowSidebar() {
  const [narrow, setNarrow] = useState(storedNarrow);
  const toggle = useCallback(
    () =>
      setNarrow((v) => {
        try {
          localStorage.setItem(narrowKey, v ? "0" : "1");
        } catch {
          // storage blocked: it just won't be remembered
        }
        return !v;
      }),
    [],
  );
  return [narrow, toggle] as const;
}

const groupKey = (label: string) => `nav-group-${label}`;
function storedOpen(label: string) {
  try {
    return localStorage.getItem(groupKey(label)) !== "closed";
  } catch {
    return true; // storage blocked: expanded, the default
  }
}

/** A row in the narrow sidebar: just the icon, its name in the tooltip and for screen readers. */
const narrowRow = (active: boolean) => cn(navRow(active), "w-9 justify-center px-0 pointer-coarse:w-9");

function SidebarLink({ item, path, narrow }: { item: NavItem; path: string; narrow?: boolean }) {
  const here = isHere(path, item);
  return (
    <Link
      to={item.to}
      aria-current={here ? "page" : undefined}
      title={narrow ? item.label : undefined}
      className={narrow ? narrowRow(here) : navRow(here)}
    >
      <item.icon size={15} strokeWidth={1.75} className="shrink-0" />
      <span className={narrow ? "sr-only" : "flex-1 truncate"}>{item.label}</span>
    </Link>
  );
}

/** A group in the narrow sidebar: its pages as icons, set apart by a rule instead of a label. */
function NarrowGroup({ info, items, path }: { info: NavGroupInfo; items: NavItem[]; path: string }) {
  return (
    <div role="group" aria-label={info.label} className="my-1 flex flex-col items-center gap-px border-y border-line py-1">
      {items.map((n) => (
        <SidebarLink key={n.to} item={n} path={path} narrow />
      ))}
    </div>
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

/** An always-open group: a small label, then its pages with their icons. */
function NavSection({ info, items, path }: { info: NavGroupInfo; items: NavItem[]; path: string }) {
  const id = `nav-section-${info.label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div role="group" aria-labelledby={id} className="my-3 flex flex-col gap-px first:mt-0 last:mb-0">
      <div id={id} className="px-2 pb-1 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">
        {info.label}
      </div>
      {items.map((n) => (
        <SidebarLink key={n.to} item={n} path={path} />
      ))}
    </div>
  );
}

function OrgSwitcher({ narrow }: { narrow?: boolean }) {
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
    {
      label: others.length > 1 ? "Organizations" : "Organization",
      orgs: others,
    },
  ].filter((g) => g.orgs.length > 0);
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn("flex min-h-10 items-center gap-2.5 rounded-md p-1 text-left hover:bg-hover", narrow ? "mx-auto" : "w-full")}
        aria-expanded={open}
        aria-label={narrow ? `Organization: ${org?.name ?? "none"}` : undefined}
        title={narrow ? (org?.name ?? "No organization") : undefined}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-[13px] font-semibold text-on-ink">{initial}</span>
        {!narrow && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium">{org?.name ?? "No organization"}</span>
              {kind && <span className="block truncate text-[12px] text-muted">{kind}</span>}
            </span>
            <ChevronsUpDown size={14} className="text-subtle" />
          </>
        )}
      </button>
      {open && (
        <div
          className={cn(
            "anim-fade absolute top-full z-30 mt-1 rounded-lg border border-line bg-surface p-1 shadow-float",
            narrow ? "left-0 w-60" : "right-0 left-0",
          )}
        >
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

/** Something the command menu does in place rather than a page it goes to, shown with its shortcut. */
type PaletteAction = { label: string; key: string; run: () => void };

function CommandPalette({ onClose, items, actions }: { onClose: () => void; items: NavItem[]; actions: PaletteAction[] }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const { admin, partner } = useSession();
  const found = useMemo(() => {
    const pages: { label: string; hint: string; to?: string; key?: string; run?: () => void }[] = [
      ...actions.map((a) => ({ label: a.label, hint: "", key: a.key, run: a.run })),
      ...items.flatMap((i) =>
        i.within
          ? i.within.map((w) => ({ label: `${i.label} · ${w.label}`, hint: "Page", to: w.to }))
          : [{ label: i.label, hint: "Page", to: i.to }],
      ),
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
      ...(admin
        ? [
            {
              label: platformAdminLabel,
              hint: "Settings",
              to: "/settings/admin-users",
            },
          ]
        : []),
      { label: "New organization", hint: "Setup", to: "/onboarding" },
    ];
    return pages.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  }, [q, items, actions, admin, partner]);
  const go = (it: (typeof found)[number]) => {
    onClose();
    if (it.run) it.run();
    else if (it.to) void navigate(it.to);
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
            if (e.key === "Enter" && found[idx]) go(found[idx]!);
          }}
          placeholder="Go to…"
          aria-label="Search"
          className="h-12 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-subtle"
        />
      </div>
      <ul className="max-h-80 overflow-y-auto p-1.5">
        {found.map((it, i) => (
          <li key={(it.to ?? "") + it.label}>
            <button
              onMouseEnter={() => setIdx(i)}
              onClick={() => go(it)}
              className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13.5px]", i === idx && "bg-hover")}
            >
              {it.label.startsWith("New ") && <Plus size={13} className="shrink-0 text-subtle" />}
              <span className="flex-1 truncate">{it.label}</span>
              {it.key ? <Kbd k={it.key} /> : <span className="text-[12px] text-subtle">{it.hint}</span>}
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
  const [narrow, toggleNarrow] = useNarrowSidebar();
  const loc = useLocation();
  const navigate = useNavigate();
  const { loading, me, org, organizations, can, signOut, features, admin } = useSession();
  const brand = useBrand();

  // Everyone who may chat has the widget, as long as the Organization has the assistant switched on.
  const hasChat = modules.ai && can("ai", "chat") && features.assistant?.on !== false;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === shortcut.search.toLowerCase()) {
        e.preventDefault();
        setCmd((v) => !v);
      } else if (k === shortcut.assistant.toLowerCase() && hasChat) {
        e.preventDefault();
        setCmd(false);
        setChatOpen((v) => !v);
      } else if (k === shortcut.sidebar) {
        e.preventDefault();
        toggleNarrow();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [hasChat, toggleNarrow]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  // Switching Organization leaves what belonged to the old one (a SEO setup in progress, a chosen Location): SEO
  // starts over from its own entry, which resumes any draft the new Organization has. The narrow-view menu closes too.
  const orgId = org?.id;
  const lastOrg = useRef(orgId);
  useEffect(() => {
    const was = lastOrg.current;
    lastOrg.current = orgId;
    // The first Organization arriving as the page loads isn't a switch: a reload or a shared link stays where it was.
    if (!was || was === orgId) return;
    setMobileNav(false); // the narrow-view menu was opened for the old Organization
    if (loc.pathname.startsWith("/seo")) void navigate("/seo", { replace: true });
  }, [orgId, loc.pathname, navigate]);

  if (loading) return null;
  if (!me) return <Navigate to="/sign-in" replace state={{ from: loc.pathname }} />;
  if (!org) return <Navigate to="/onboarding" replace />;

  // A feature that's off hides its menu entry, and its page says so (Settings → Features turns it back on).
  const switched = (n: NavItem) => !n.feature || features[n.feature]?.on !== false;
  const items = nav.filter((n) => (!n.when || n.when(can)) && switched(n));
  const offHere = nav.find((n) => n.feature && isHere(loc.pathname, n) && !switched(n));
  const chatButton = hasChat && !onPath(loc.pathname, "/widgets");
  const openChat = () => {
    setChatOpen(!chatOpen);
    setMobileNav(false);
  };
  const actions: PaletteAction[] = [
    ...(hasChat ? [{ label: `Ask ${brand.assistant}`, key: shortcut.assistant, run: () => setChatOpen(true) }] : []),
    { label: narrow ? "Widen sidebar" : "Narrow sidebar", key: shortcut.sidebar, run: toggleNarrow },
  ];

  const pages = items.filter((n) => !n.foot);
  const foot = items.filter((n) => n.foot);
  const sidebarToggle = (
    <button
      onClick={toggleNarrow}
      aria-label={narrow ? "Widen sidebar" : "Narrow sidebar"}
      title={`${narrow ? "Widen sidebar" : "Narrow sidebar"} (${keys(shortcut.sidebar)})`}
      className={cn(iconBtn, "hidden lg:grid")}
    >
      {narrow ? <PanelLeftOpen size={15} strokeWidth={1.75} /> : <PanelLeftClose size={15} strokeWidth={1.75} />}
    </button>
  );
  const themeButton = (
    <button
      onClick={() => setDark(!dark)}
      aria-label={dark ? "Light mode" : "Dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={iconBtn}
    >
      {dark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
    </button>
  );
  const signOutButton = (
    <button onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className={iconBtn}>
      <LogOut size={15} strokeWidth={1.75} />
    </button>
  );
  const roleLine = `${roleName(org.role)}${admin ? ` · ${platformAdminLabel}` : ""}`;

  // Search and the assistant are icons beside the logo; their tooltips and the command menu name the shortcuts.
  const sidebar = (
    <div className="flex h-full flex-col gap-1 px-2.5 py-2.5">
      <div className="flex h-8 items-center gap-0.5">
        <NavLink to="/" aria-label={`${brand.name} home`} className="mr-auto flex h-7 items-center rounded-md px-2 hover:bg-hover">
          <Logo size={17} />
        </NavLink>
        {hasChat && (
          <button
            onClick={openChat}
            aria-label={`Ask ${brand.assistant}`}
            aria-pressed={chatOpen}
            title={`Ask ${brand.assistant} (${keys(shortcut.assistant)})`}
            className={iconBtn}
          >
            <Sparkles size={15} strokeWidth={1.75} />
          </button>
        )}
        <button onClick={() => setCmd(true)} aria-label="Search" title={`Search (${keys(shortcut.search)})`} className={iconBtn}>
          <Search size={15} strokeWidth={1.75} />
        </button>
        {sidebarToggle}
      </div>
      <OrgSwitcher />
      <nav className="mt-1 flex flex-1 flex-col gap-px overflow-y-auto" aria-label="Main">
        {pages.map((n, i) => {
          if (n.group && pages[i - 1]?.group === n.group) return null; // listed with the first of its group
          if (n.group?.section)
            return <NavSection key={n.group.label} info={n.group} items={pages.filter((p) => p.group === n.group)} path={loc.pathname} />;
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
              <div
                className="truncate text-[12px] text-muted"
                title={`Your role in ${org.name}${admin ? `, and ${platformAdminLabel.toLowerCase()} of the whole app` : ""}`}
              >
                {roleLine}
              </div>
            </div>
          </div>
          {themeButton}
          {signOutButton}
        </div>
      </div>
    </div>
  );

  // The narrow sidebar: the same things as icons, their names and shortcuts in tooltips. Wide screens only.
  const narrowSidebar = (
    <div className="flex h-full flex-col items-center gap-1 px-2 py-2.5">
      <NavLink
        to="/"
        aria-label={`${brand.name} home`}
        title={brand.name}
        className="grid h-8 w-9 place-items-center rounded-md hover:bg-hover"
      >
        <LogoMark size={18} />
      </NavLink>
      {sidebarToggle}
      <OrgSwitcher narrow />
      <button onClick={() => setCmd(true)} aria-label="Search" title={`Search (${keys(shortcut.search)})`} className={narrowRow(false)}>
        <Search size={15} strokeWidth={1.75} />
      </button>
      {hasChat && (
        <button
          onClick={openChat}
          aria-label={`Ask ${brand.assistant}`}
          aria-pressed={chatOpen}
          title={`Ask ${brand.assistant} (${keys(shortcut.assistant)})`}
          className={narrowRow(chatOpen)}
        >
          <Sparkles size={15} strokeWidth={1.75} />
        </button>
      )}
      <nav className="mt-1 flex w-full flex-1 flex-col items-center gap-px overflow-y-auto border-t border-line pt-2" aria-label="Main">
        {pages.map((n, i) => {
          if (n.group && pages[i - 1]?.group === n.group) return null;
          if (n.group)
            return <NarrowGroup key={n.group.label} info={n.group} items={pages.filter((p) => p.group === n.group)} path={loc.pathname} />;
          return <SidebarLink key={n.to} item={n} path={loc.pathname} narrow />;
        })}
      </nav>
      <div className="flex w-full flex-col items-center gap-1 border-t border-line pt-2">
        {foot.map((n) => (
          <SidebarLink key={n.to} item={n} path={loc.pathname} narrow />
        ))}
        <span title={`${me.name} · ${roleLine}`} className="py-0.5">
          <Avatar name={me.name} className="size-7 text-[11px]" />
        </span>
        {themeButton}
        {signOutButton}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside
        className={cn(
          "sidebar-scope sticky top-0 hidden h-screen shrink-0 border-r border-line bg-sidebar lg:block print:hidden",
          narrow ? "w-14" : "w-60",
        )}
      >
        {narrow ? narrowSidebar : sidebar}
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
      {cmd && <CommandPalette onClose={() => setCmd(false)} items={items} actions={actions} />}
      {AppChat && hasChat && (
        <Suspense fallback={null}>
          {/* No floating button on Widgets: the page has its own widget in the preview, and two would confuse. */}
          <AppChat key={org.id} open={chatOpen} onOpenChange={setChatOpen} launcher={chatButton} />
        </Suspense>
      )}
    </div>
  );
}
