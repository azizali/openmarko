import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutGrid, TrendingUp, Grid3x3, Users, Gauge, ScanSearch, Lightbulb, Wand2, Store, FileText,
  Settings, Search, ChevronsUpDown, Moon, Sun, Menu, Check, Rocket, CornerDownLeft,
} from "lucide-react";
import { cn } from "./ui";
import { actions, keywords, locations } from "../data/mock";

const nav = [
  { group: null, items: [{ to: "/", label: "Overview", icon: LayoutGrid }] },
  { group: "Track", items: [
    { to: "/rankings", label: "Rankings", icon: TrendingUp },
    { to: "/grid", label: "Rank pack", icon: Grid3x3 },
    { to: "/competitors", label: "Competitors", icon: Users },
  ] },
  { group: "Analyze", items: [
    { to: "/factors", label: "Ranking factors", icon: Gauge },
    { to: "/audit", label: "Site audit", icon: ScanSearch },
    { to: "/keywords", label: "Keyword ideas", icon: Lightbulb },
  ] },
  { group: "Improve", items: [
    { to: "/actions", label: "Action plan", icon: Wand2, badge: actions.filter((a) => a.status === "suggested").length },
    { to: "/profile", label: "Business Profile", icon: Store },
  ] },
  { group: null, items: [{ to: "/reports", label: "Reports", icon: FileText }] },
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
      {badge ? <span className="num rounded bg-accent-soft px-1.5 text-[11.5px] font-medium text-accent">{badge}</span> : null}
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
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent font-serif text-[15px] text-white">M</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{loc.name}</span>
          <span className="block truncate text-[12px] text-muted">{loc.city}</span>
        </span>
        <ChevronsUpDown size={14} className="text-subtle" />
      </button>
      {open && (
        <div className="anim-fade absolute top-full right-0 left-0 z-30 mt-1 rounded-lg border border-line bg-surface p-1 shadow-lg">
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
    const pages = nav.flatMap((g) => g.items).map((i) => ({ label: i.label, hint: "Page", to: i.to }));
    const extra = [{ label: "Settings & integrations", hint: "Page", to: "/settings" }, { label: "Run setup again", hint: "Onboarding", to: "/onboarding" }];
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
      <div className="anim-fade relative h-fit w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-2xl" role="dialog" aria-label="Command menu">
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
  const [cmd, setCmd] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const loc = useLocation();
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
      <LocationSwitcher />
      <button onClick={() => setCmd(true)} className="mt-1 mb-2 flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] text-muted hover:bg-hover">
        <Search size={16} strokeWidth={1.75} />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-line px-1 text-[11px] text-subtle">⌘K</kbd>
      </button>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Main">
        {nav.map((g, i) => (
          <div key={i} className={cn(g.group ? "mt-4" : i ? "mt-4" : "")}>
            {g.group && <div className="mb-1 px-2 text-[11.5px] font-medium text-subtle">{g.group}</div>}
            {g.items.map((it) => <NavItem key={it.to} {...it} />)}
          </div>
        ))}
      </nav>
      <NavLink to="/onboarding" className="mb-2 rounded-lg border border-line bg-surface p-3 hover:bg-hover">
        <div className="flex items-center gap-2 text-[13px] font-medium"><Rocket size={14} /> Setup 4 of 5</div>
        <div className="mt-2 h-1 rounded-full bg-hover"><div className="h-full w-4/5 rounded-full bg-accent" /></div>
        <div className="mt-1.5 text-[12px] text-muted">Connect Google Analytics</div>
      </NavLink>
      <NavItem to="/settings" label="Settings" icon={Settings} />
      <button onClick={() => setDark(!dark)} className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] text-muted hover:bg-hover hover:text-fg">
        {dark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        {dark ? "Light mode" : "Dark mode"}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-sidebar lg:block">{sidebar}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileNav(false)} />
          <aside className="anim-fade absolute inset-y-0 left-0 w-64 border-r border-line bg-sidebar">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setMobileNav(true)} aria-label="Open navigation" className="rounded p-1.5 hover:bg-hover"><Menu size={18} /></button>
          <span className="font-serif text-[17px]">Groundwork</span>
        </div>
        <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </div>
  );
}
