import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutGrid, ListChecks, TrendingUp, Users, Gauge, ScanSearch, Lightbulb, Store, FileText, History,
  Sparkles, MapPinned, Newspaper, Settings, Search, ChevronsUpDown, ChevronDown, ArrowLeft, Moon, Sun, Menu, Check, Rocket, CornerDownLeft, Target, Palette,
} from "lucide-react";
import { cn } from "./ui";
import { Logo } from "./Logo";
import { keywords, locations } from "../data/mock";
import { openTasksFor, useRunState } from "../lib/tasks";
import { runningOf, useRuns } from "../lib/runs";
import { Freshness, RunButton, kindForPath } from "./RunStatus";

const home = { to: "/", label: "Command Center", icon: LayoutGrid };
const todo = { to: "/todo", label: "To-do", icon: ListChecks };
const sales = [{ to: "/prospects", label: "Prospecting", icon: Target }];
const runsNav = { to: "/runs", label: "Runs", icon: History };
const deepDives = [
  { to: "/rankings", label: "Rankings", icon: TrendingUp },
  { to: "/competitors", label: "Competitors", icon: Users },
  { to: "/ai", label: "AI visibility", icon: Sparkles },
  { to: "/citations", label: "Citations & backlinks", icon: MapPinned },
  { to: "/factors", label: "Ranking factors", icon: Gauge },
  { to: "/audit", label: "Site audit", icon: ScanSearch },
  { to: "/keywords", label: "Keyword ideas", icon: Lightbulb },
  { to: "/content", label: "Content", icon: Newspaper },
  { to: "/profile", label: "Business Profile", icon: Store },
  { to: "/reports", label: "Reports", icon: FileText },
];

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const s = localStorage.getItem("gw-theme");
      if (s) return s === "dark";
    } catch {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("gw-theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  return [dark, setDark] as const;
}

// Swatch colors mirror each flavor's light-mode sidebar/ink and accent in index.css.
const flavors = [
  { id: "origami", label: "Origami", a: "#09090b", b: "#fe7bcd" },
  { id: "ultraviolet", label: "Ultraviolet", a: "#17133a", b: "#a78bfa" },
  { id: "marigold", label: "Marigold", a: "#faefdc", b: "#ea580c" },
  { id: "lagoon", label: "Lagoon", a: "#0c2a27", b: "#2dd4bf" },
  { id: "blueprint", label: "Blueprint", a: "#2140d9", b: "#d93a2b" },
] as const;
type Flavor = (typeof flavors)[number]["id"];

function useFlavor() {
  const [flavor, setFlavor] = useState<Flavor>(() => {
    try {
      const s = localStorage.getItem("gw-flavor");
      if (flavors.some((f) => f.id === s)) return s as Flavor;
    } catch {}
    return "origami";
  });
  useEffect(() => {
    const root = document.documentElement;
    if (flavor === "origami") delete root.dataset.flavor;
    else root.dataset.flavor = flavor;
    try { localStorage.setItem("gw-flavor", flavor); } catch {}
  }, [flavor]);
  return [flavor, setFlavor] as const;
}

function FlavorPicker({ value, onChange }: { value: Flavor; onChange: (f: Flavor) => void }) {
  return (
    <div className="flex h-8 items-center gap-2.5 px-2 text-[13.5px] text-muted">
      <Palette size={16} strokeWidth={1.75} className="shrink-0" />
      <span className="flex-1">Theme</span>
      <div role="radiogroup" aria-label="Color theme" className="flex shrink-0 items-center gap-0.5">
        {flavors.map((f) => (
          <button
            key={f.id}
            role="radio"
            aria-checked={value === f.id}
            aria-label={f.label}
            title={f.label}
            onClick={() => onChange(f.id)}
            className={cn("grid size-5 place-items-center rounded-full transition-shadow", value === f.id ? "ring-2 ring-line-strong" : "hover:ring-2 hover:ring-line")}
          >
            <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${f.a} 50%, ${f.b} 50%)` }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function NavItem({ to, label, icon: Icon, badge, onClick }: { to: string; label: string; icon: typeof LayoutGrid; badge?: number; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        cn("flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors", isActive ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg")
      }
    >
      <Icon size={16} strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {badge ? <span className="num min-w-5 rounded-full bg-active px-1.5 text-center text-[11px] font-medium text-muted">{badge}</span> : null}
    </NavLink>
  );
}

function LocationSwitcher() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(locations[0].id);
  const loc = locations.find((l) => l.id === cur)!;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-hover" aria-expanded={open}>
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-[13px] font-semibold text-on-ink">M</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{loc.name}</span>
          <span className="block truncate text-[12px] text-muted">{loc.city}</span>
        </span>
        <ChevronsUpDown size={14} className="text-subtle" />
      </button>
      {open && (
        <div className="anim-fade absolute top-full right-0 left-0 z-30 mt-1 rounded-lg border border-line bg-surface p-1 shadow-float">
          {locations.map((l) => (
            <button key={l.id} onClick={() => { setCur(l.id); setOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover">
              <span className="flex-1 truncate">{l.name}</span>
              {l.id === cur && <Check size={14} />}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <NavLink to="/onboarding" className="block rounded px-2 py-1.5 text-[13px] text-muted hover:bg-hover">+ Add location</NavLink>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const items = useMemo(() => {
    const pages = [home, todo, ...sales, ...deepDives, runsNav].map((i) => ({ label: i.label, hint: "Page", to: i.to }));
    const extra = [{ label: "Audit a business", hint: "Prospecting", to: "/prospects?new=audit" }, { label: "Settings & integrations", hint: "Page", to: "/settings" }, { label: "Run setup again", hint: "Onboarding", to: "/onboarding" }];
    const kws = keywords.map((k) => ({ label: k.term, hint: "Keyword", to: `/rankings/${k.id}` }));
    return [...pages, ...extra, ...kws].filter((i) => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 9);
  }, [q]);
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => { if (open) setQ(""); }, [open]);
  if (!open) return null;
  const go = (to: string) => { navigate(to); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex justify-center px-4 pt-[14vh]">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="anim-fade relative h-fit w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-float" role="dialog" aria-label="Command menu">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="text-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter" && items[idx]) go(items[idx].to);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search pages, keywords…"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-subtle"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {items.map((it, i) => (
            <li key={it.to + it.label}>
              <button onMouseEnter={() => setIdx(i)} onClick={() => go(it.to)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13.5px]", i === idx && "bg-hover")}>
                <span className="flex-1 truncate">{it.label}</span>
                <span className="text-[12px] text-subtle">{it.hint}</span>
                {i === idx && <CornerDownLeft size={13} className="text-subtle" />}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-[13px] text-muted">No results for “{q}”</li>}
        </ul>
      </div>
    </div>
  );
}

export default function Layout() {
  const [dark, setDark] = useTheme();
  const [flavor, setFlavor] = useFlavor();
  const [cmd, setCmd] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [deepOpen, setDeepOpen] = useState(true);
  const runState = useRunState();
  const live = runningOf(useRuns()).length;
  const loc = useLocation();
  const kind = kindForPath(loc.pathname);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { setMobileNav(false); window.scrollTo(0, 0); }, [loc.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col gap-1 px-2.5 py-3">
      <NavLink to="/" aria-label="OpenMarko home" className="mb-3 flex h-8 items-center px-2"><Logo size={22} /></NavLink>
      <LocationSwitcher />
      <button onClick={() => setCmd(true)} className="mt-1 mb-2 flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] text-muted hover:bg-hover">
        <Search size={16} strokeWidth={1.75} />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-line bg-surface px-1 font-sans text-[11px] text-subtle">⌘K</kbd>
      </button>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Main">
        <NavItem {...home} />
        <div className="ml-[17px] border-l border-line pl-2"><NavItem {...todo} badge={openTasksFor(runState).length} /></div>
        <div className="mt-5 mb-1 px-2 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Sales</div>
        {sales.map((it) => <NavItem key={it.to} {...it} />)}
        <button onClick={() => setDeepOpen(!deepOpen)} aria-expanded={deepOpen} className="mt-5 mb-1 flex items-center gap-1 px-2 text-left text-[11px] font-medium tracking-[0.06em] text-subtle uppercase hover:text-muted">
          Deep dives <ChevronDown size={12} className={cn("transition-transform", !deepOpen && "-rotate-90")} />
        </button>
        {deepOpen && deepDives.map((it) => <NavItem key={it.to} {...it} />)}
      </nav>
      <NavLink to="/onboarding" className="mb-2 rounded-lg border border-line bg-surface p-3 shadow-card transition-colors hover:border-line-strong">
        <div className="flex items-center gap-2 text-[13px] font-medium"><Rocket size={14} /> Setup 4 of 5</div>
        <div className="mt-2 h-1 rounded-full bg-hover"><div className="h-full w-4/5 rounded-full bg-accent" /></div>
        <div className="mt-1.5 text-[12px] text-muted">Connect Google Analytics</div>
      </NavLink>
      <NavItem {...runsNav} badge={live || undefined} />
      <NavItem to="/settings" label="Settings" icon={Settings} />
      <FlavorPicker value={flavor} onChange={setFlavor} />
      <button onClick={() => setDark(!dark)} className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] text-muted hover:bg-hover hover:text-fg">
        {dark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        {dark ? "Light mode" : "Dark mode"}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sidebar-scope sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-sidebar lg:block print:hidden">{sidebar}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileNav(false)} />
          <aside className="sidebar-scope anim-fade absolute inset-y-0 left-0 w-64 border-r border-line bg-sidebar">{sidebar}</aside>
        </div>
      )}
      <div className="relative min-w-0 flex-1">
        <div aria-hidden className="grid-backdrop pointer-events-none absolute inset-x-0 top-0 h-[520px] print:hidden" />
        <div className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden print:hidden">
          <button onClick={() => setMobileNav(true)} aria-label="Open navigation" className="rounded p-1.5 hover:bg-hover"><Menu size={18} /></button>
          <Logo size={20} />
        </div>
        <main className="relative mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mb-5 flex min-h-9 flex-wrap items-center justify-between gap-3 print:hidden">
            {loc.pathname !== "/" && !loc.pathname.startsWith("/prospects/") ? (
              <NavLink to="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><ArrowLeft size={13} /> Command Center</NavLink>
            ) : <span />}
            <div className="flex flex-wrap items-center gap-3">
              <Freshness kind={kind} />
              {kind && kind !== "prospect" && <RunButton kind={kind} variant={loc.pathname === "/" ? "primary" : "secondary"} />}
            </div>
          </div>
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </div>
  );
}
