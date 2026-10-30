import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutGrid, ListChecks, TrendingUp, MessageSquareText, MapPinned, ScanSearch, FileText, Settings, Search, ChevronsUpDown, ChevronDown, ArrowLeft,
  Moon, Sun, Menu, Check, Rocket, CornerDownLeft, Target, Sparkles, Flame, CalendarDays,
} from "lucide-react";
import { cn } from "./ui";
import { Logo } from "./Logo";
import { keywords, locations, workspace } from "../data/mock";
import { openTasksFor, useRunState } from "../lib/tasks";
import { runningOf, useRuns } from "../lib/runs";
import { useTheme } from "../lib/theme";
import { Freshness, RunButton, kindForPath } from "./RunStatus";
import { AssistantPanel, MarkoLauncher } from "./Assistant";
import { ask, toggleAssistant, type PageContext } from "../lib/assistant";
import { accountSections, businessSections } from "../pages/Settings";

type Leaf = { to: string; label: string };
type Nav = Leaf & { icon: typeof LayoutGrid; children?: Leaf[]; section?: string };

// Every page is one click from the sidebar, under a section per kind of marketing
// (SEO, Social, Sales). Groups list their pages as sub-items; the group holding
// the current page is open, the rest open with their chevron. Marko's setup
// (Brand voice, Skills) and Activity live in Settings.
const nav: Nav[] = [
  { to: "/", label: "Home", icon: LayoutGrid },
  { to: "/todo", label: "To-do", icon: ListChecks },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/rankings", label: "Rankings", icon: TrendingUp, section: "SEO", children: [
    { to: "/rankings", label: "Keywords & map pack" },
    { to: "/competitors", label: "Competitors" },
    { to: "/ai", label: "AI answers" },
    { to: "/factors", label: "Ranking factors" },
    { to: "/keywords", label: "Keyword ideas" },
  ] },
  { to: "/profile?tab=reviews", label: "Reviews & content", icon: MessageSquareText, children: [
    { to: "/profile?tab=reviews", label: "Reviews" },
    { to: "/content", label: "Articles" },
    { to: "/profile", label: "Business Profile" },
  ] },
  { to: "/citations", label: "Citations & backlinks", icon: MapPinned, children: [
    { to: "/citations", label: "Citations" },
    { to: "/citations?tab=links", label: "Backlinks" },
  ] },
  { to: "/audit", label: "Site health", icon: ScanSearch },
  { to: "/social/trends", label: "Trending ideas", icon: Flame, section: "Social" },
  { to: "/social/posts", label: "Posts & calendar", icon: CalendarDays },
  ...(workspace.plan === "agency" ? [{ to: "/prospects", label: "Prospecting", icon: Target, section: "Sales" }] : []),
];
const settingsNav: Nav = { to: "/settings", label: "Settings", icon: Settings };
const settingsLeaves: Leaf[] = [...businessSections, ...accountSections].map((s) => ({ to: `/settings/${s.id}`, label: s.label }));

const split = (to: string) => { const [path, q = ""] = to.split("?"); return { path, params: new URLSearchParams(q) }; };
const onPath = (path: string, to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`));

/** The leaf that matches the current URL best: right path, and the most query params that agree. */
function activeLeaf(leaves: Leaf[], pathname: string, search: string): Leaf | undefined {
  const cur = new URLSearchParams(search);
  const fits = leaves
    .map((l) => ({ l, ...split(l.to) }))
    .filter(({ path, params }) => onPath(pathname, path) && [...params].every(([k, v]) => cur.get(k) === v));
  return fits.sort((a, b) => [...b.params].length - [...a.params].length)[0]?.l;
}
const inGroup = (n: Nav, pathname: string) => (n.children ?? [n]).some((l) => onPath(pathname, split(l.to).path));

const iconBtn = "grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg";
const row = (active: boolean) => cn("flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors", active ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg");

function NavItem({ item, badge, open, onToggle }: { item: Nav; badge?: number; open?: boolean; onToggle?: () => void }) {
  const { pathname, search } = useLocation();
  const Icon = item.icon;
  const here = inGroup(item, pathname);
  const leaf = item.children && activeLeaf(item.children, pathname, search);
  return (
    <div>
      <div className="flex items-center">
        <Link to={item.to} aria-current={here && !item.children ? "page" : undefined} className={cn(row(here && !item.children), "min-w-0 flex-1", here && item.children && "font-medium text-fg")}>
          <Icon size={15} strokeWidth={1.75} className="shrink-0" />
          <span className="flex-1 truncate">{item.label}</span>
          {badge ? <span className="num min-w-5 rounded-full bg-active px-1.5 text-center text-[11px] font-medium text-muted">{badge}</span> : null}
        </Link>
        {item.children && (
          <button onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${item.label} pages`} className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-hover hover:text-fg">
            <ChevronDown size={14} className={cn("transition-transform", !open && "-rotate-90")} />
          </button>
        )}
      </div>
      {item.children && open && (
        <div className="my-px ml-[14px] flex flex-col gap-px border-l border-line pl-2">
          {item.children.map((c) => (
            <Link key={c.to} to={c.to} aria-current={c === leaf ? "page" : undefined} className={cn(row(c === leaf), "h-[26px] text-[12.5px]")}>{c.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** What Marko is "looking at": the page's sidebar name, plus a keyword when one is open. */
function pageContext(pathname: string, search: string): PageContext {
  const item = [...nav, settingsNav].find((n) => inGroup(n, pathname));
  const leaf = item === settingsNav ? activeLeaf(settingsLeaves, pathname, search) : item?.children ? activeLeaf(item.children, pathname, search) : item;
  const kw = pathname.match(/^\/rankings\/([^/]+)/)?.[1] ?? new URLSearchParams(search).get("kw") ?? undefined;
  return { label: leaf?.label ?? "This page", path: pathname, keywordId: kw };
}

function LocationSwitcher() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(locations[0].id);
  const loc = locations.find((l) => l.id === cur)!;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-hover" aria-expanded={open}>
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-[13px] font-semibold text-on-ink">M</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium">{loc.name}</span>
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

function CommandPalette({ open, onClose, ctx }: { open: boolean; onClose: () => void; ctx: PageContext }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const items = useMemo(() => {
    const pages = [
      ...nav.flatMap((n) => n.children ?? [n]).map((i) => ({ label: i.label, hint: "Page", to: i.to })),
      ...settingsLeaves.map((i) => ({ label: i.label, hint: "Settings", to: i.to })),
    ];
    const extra = [
      ...(workspace.plan === "agency" ? [{ label: "Audit a business", hint: "Prospecting", to: "/prospects?new=audit" }] : []),
      { label: "Run setup again", hint: "Onboarding", to: "/onboarding" },
    ];
    const kws = keywords.map((k) => ({ label: k.term, hint: "Keyword", to: `/rankings/${k.id}` }));
    const found = [...pages, ...extra, ...kws].filter((i) => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
    // Anything typed can go to Marko. It leads when nothing matches or it reads like a sentence.
    if (q.trim().length < 2) return found;
    const askRow = { label: `Ask Marko: “${q.trim()}”`, hint: "Ask", to: "", ask: true };
    return !found.length || q.trim().split(/\s+/).length >= 3 ? [askRow, ...found] : [...found, askRow];
  }, [q]);
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => { if (open) setQ(""); }, [open]);
  if (!open) return null;
  const go = (it: { to: string; ask?: boolean }) => { if (it.ask) ask(q, ctx); else navigate(it.to); onClose(); };
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
              if (e.key === "Enter" && items[idx]) go(items[idx]);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search, or tell Marko what to do…"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-subtle"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {items.map((it, i) => (
            <li key={it.to + it.label}>
              <button onMouseEnter={() => setIdx(i)} onClick={() => go(it)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13.5px]", i === idx && "bg-hover")}>
                {"ask" in it && <Sparkles size={14} className="shrink-0 text-accent" />}
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
  const runState = useRunState();
  const live = runningOf(useRuns()).length;
  const loc = useLocation();
  const kind = kindForPath(loc.pathname);
  const ctx = pageContext(loc.pathname, loc.search);
  // A group is open while it holds the current page, unless its chevron says otherwise.
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const shown = (n: Nav) => manual[n.label] ?? inGroup(n, loc.pathname);
  const toggle = (n: Nav) => setManual((m) => ({ ...m, [n.label]: !shown(n) }));
  // Arriving in a group opens it, even if it was closed by hand earlier.
  useEffect(() => {
    const here = nav.find((n) => n.children && inGroup(n, loc.pathname));
    if (here) setManual((m) => (m[here.label] === false ? { ...m, [here.label]: true } : m));
  }, [loc.pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); toggleAssistant(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { setMobileNav(false); }, [loc.pathname, loc.search]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col gap-1 px-2.5 py-2.5">
      {/* Logo, Search and Ask Marko share one row; the shortcuts are in the tooltips. */}
      <div className="flex h-8 items-center gap-0.5">
        <NavLink to="/" aria-label="OpenMarko home" className="mr-auto flex h-7 items-center rounded-md px-2 hover:bg-hover"><Logo size={17} /></NavLink>
        <button onClick={() => setCmd(true)} aria-label="Search" title="Search (⌘K)" className={iconBtn}><Search size={15} strokeWidth={1.75} /></button>
        <button onClick={toggleAssistant} aria-label="Ask Marko" title="Ask Marko (⌘J)" className={iconBtn}><Sparkles size={15} strokeWidth={1.75} /></button>
      </div>
      {locations.length > 1 && <LocationSwitcher />}
      <nav className="mt-1 flex flex-1 flex-col gap-px overflow-y-auto" aria-label="Main">
        {nav.map((n) => (
          <div key={n.label}>
            {n.section && <div className="mt-3 mb-0.5 px-2 text-[10.5px] font-medium tracking-[0.06em] text-subtle uppercase">{n.section}</div>}
            <NavItem item={n} badge={n.to === "/todo" ? openTasksFor(runState).length : undefined} open={shown(n)} onToggle={() => toggle(n)} />
          </div>
        ))}
      </nav>
      <NavLink to="/onboarding" className="mb-1 rounded-lg border border-line bg-surface px-2.5 py-2 shadow-card transition-colors hover:border-line-strong">
        <div className="flex items-center gap-2 text-[12.5px] font-medium"><Rocket size={13} /> Setup 4 of 5<span className="ml-auto truncate text-[11.5px] font-normal text-muted">Connect GA4</span></div>
        <div className="mt-1.5 h-1 rounded-full bg-hover"><div className="h-full w-4/5 rounded-full bg-accent" /></div>
      </NavLink>
      <div className="flex items-center gap-0.5">
        {/* Live runs show on Settings, where Activity lives. */}
        <div className="min-w-0 flex-1"><NavItem item={settingsNav} badge={live || undefined} /></div>
        <button onClick={() => setDark(!dark)} aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"} className={iconBtn}>
          {dark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
        </button>
      </div>
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
          <button onClick={() => setDark(!dark)} aria-label={dark ? "Light mode" : "Dark mode"} className="ml-auto rounded p-1.5 hover:bg-hover">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
        <main className="relative mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mb-5 flex min-h-9 flex-wrap items-center justify-between gap-3 print:hidden">
            {/* Detail pages one level down (an audit issue, a competitor) get a way back. */}
            {loc.pathname.split("/").length > 2 && !/^\/(prospects|social|settings)\//.test(loc.pathname) ? (
              <NavLink to={`/${loc.pathname.split("/")[1]}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><ArrowLeft size={13} /> Back</NavLink>
            ) : <span />}
            <div className="flex flex-wrap items-center gap-3">
              <Freshness kind={kind} />
              {kind && kind !== "prospect" && <RunButton kind={kind} variant={loc.pathname === "/" ? "primary" : "secondary"} />}
            </div>
          </div>
          <Outlet context={ctx} />
        </main>
      </div>
      <AssistantPanel ctx={ctx} />
      <MarkoLauncher />
      <CommandPalette open={cmd} onClose={() => setCmd(false)} ctx={ctx} />
    </div>
  );
}
