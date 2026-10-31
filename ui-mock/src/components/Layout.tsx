import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutGrid, ListChecks, TrendingUp, MessageSquareText, MapPinned, ScanSearch, FileText, Settings, Search, ChevronsUpDown, ChevronDown, ArrowLeft,
  Moon, Sun, Menu, Check, Rocket, CornerDownLeft, Target, Sparkles, Radar, Bookmark, CalendarDays, Plus, Megaphone, Inbox, UsersRound, Send, Workflow, Lock,
} from "lucide-react";
import { cn } from "./ui";
import { Logo } from "./Logo";
import { keywords, locations, member } from "../data/mock";
import { memberships, shortLocation } from "../data/org";
import { setScope, useScope } from "../lib/scope";
import { openTasksFor, useRunState } from "../lib/tasks";
import { runningOf, useRuns } from "../lib/runs";
import { useTheme } from "../lib/theme";
import { unreadCount, useCrm } from "../lib/crm";
import { featureForPage, isOn, pageOn, settingsOwner, statusOf, useFeatures } from "../lib/features";
import { featureOf } from "../data/features";
import { Freshness, RunButton, kindForPath } from "./RunStatus";
import { AssistantPanel, MarkoLauncher } from "./Assistant";
import { ask, toggleAssistant, type PageContext } from "../lib/assistant";
import { accountSections, businessSections, sectionAllowed } from "../pages/Settings";
import { can, myRole, pageAllowed, setPreview, useAccess, viewOnly } from "../lib/access";
import { ViewOnly } from "./ViewOnly";
import { assistant, product } from "../lib/whitelabel";

type Leaf = { to: string; label: string };
type Nav = Leaf & { icon: typeof LayoutGrid; children?: Leaf[]; section?: string };

// Every page is one click from the sidebar, under a section per kind of marketing
// (SEO, Social, Ads, Customers, Sales). Groups list their pages as sub-items; the group holding
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
  { to: "/social/scanner", label: "Social scanner", icon: Radar, section: "Social" },
  { to: "/social/swipe", label: "Swipe file", icon: Bookmark },
  { to: "/social/posts", label: "Posts & calendar", icon: CalendarDays },
  { to: "/ads", label: "Ads", icon: Megaphone, section: "Ads", children: [
    { to: "/ads", label: "Campaigns" },
    { to: "/ads/research", label: "Ad research" },
    { to: "/ads/research?tab=swipe", label: "Ad swipe file" },
    { to: "/ads/studio", label: "Creative studio" },
  ] },
  { to: "/inbox", label: "Inbox", icon: Inbox, section: "Customers" },
  { to: "/contacts", label: "Contacts", icon: UsersRound },
  { to: "/campaigns", label: "Campaigns", icon: Send },
  { to: "/workflows", label: "Workflows", icon: Workflow },
  ...(member.plan === "agency" ? [{ to: "/prospects", label: "Prospecting", icon: Target, section: "Sales", children: [
    { to: "/prospects", label: "Find businesses" },
    { to: "/outreach", label: "Outreach" },
  ] }] : []),
];
const settingsNav: Nav = { to: "/settings", label: "Settings", icon: Settings };

/** The sidebar without turned-off features or pages the role can't see. A group keeps its section heading if its first item is hidden. */
function visibleNav(f: ReturnType<typeof useFeatures>): Nav[] {
  let section: string | undefined;
  let shownSection: string | undefined;
  return nav.flatMap((n) => {
    if (n.section) section = n.section;
    const kids = n.children?.filter((c) => pageOn(c.to, f) && pageAllowed(c.to));
    if (kids ? !kids.length : !(pageOn(n.to, f) && pageAllowed(n.to))) return [];
    const item: Nav = { ...n, section: section !== shownSection ? section : undefined, children: kids, to: kids && !kids.some((k) => k.to === n.to) ? kids[0].to : n.to };
    shownSection = section;
    return [item];
  });
}
const settingsLeaves: Leaf[] = [...businessSections, ...accountSections].map((s) => ({ to: `/settings/${s.id}`, label: s.label }));

const split = (to: string) => { const [path, q = ""] = to.split("?"); return { path, params: new URLSearchParams(q) }; };
const onPath = (path: string, to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`));

/** The leaf that matches the current URL best: right path, and the most query params that agree. */
function activeLeaf(leaves: Leaf[], pathname: string, search: string): Leaf | undefined {
  const cur = new URLSearchParams(search);
  const fits = leaves
    .map((l) => ({ l, ...split(l.to) }))
    .filter(({ path, params }) => onPath(pathname, path) && [...params].every(([k, v]) => cur.get(k) === v));
  // Most agreeing params first, then the deepest path (/ads/studio over /ads).
  return fits.sort((a, b) => [...b.params].length - [...a.params].length || b.path.length - a.path.length)[0]?.l;
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

/**
 * The Organization being worked on, and the Scope within it. Agency Members can
 * switch Organizations; with several Locations you can look at all or one.
 */
function OrgSwitcher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { orgId, locationId } = useScope();
  const org = memberships.find((m) => m.id === orgId) ?? memberships[0];
  const sub = locationId ? shortLocation(locationId) : locations.length > 1 ? `All ${locations.length} locations` : locations[0]?.city;
  const row = "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-hover" aria-expanded={open}>
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-[13px] font-semibold text-on-ink">{org.initial}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium">{org.name}</span>
          <span className="block truncate text-[12px] text-muted">{sub}</span>
        </span>
        <ChevronsUpDown size={14} className="text-subtle" />
      </button>
      {open && (
        <div className="anim-fade absolute top-full right-0 left-0 z-30 mt-1 rounded-lg border border-line bg-surface p-1 shadow-float">
          {locations.length > 1 && (
            <>
              <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Show</div>
              {[null, ...locations.map((l) => l.id)].map((id) => (
                <button key={id ?? "all"} onClick={() => { setScope({ locationId: id }); setOpen(false); }} className={row}>
                  <span className="flex-1 truncate">{id ? shortLocation(id) : "All locations"}</span>
                  {id === locationId && <Check size={14} />}
                </button>
              ))}
              <NavLink to="/settings/locations" onClick={() => setOpen(false)} className="block rounded px-2 py-1.5 text-[13px] text-muted hover:bg-hover">+ Add location</NavLink>
            </>
          )}
          {/* Always listed, so even a single Organization has its settings button here. */}
          <>
              {locations.length > 1 && <div className="my-1 border-t border-line" />}
              <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">{memberships.length > 1 ? "Organizations" : "Organization"}</div>
              {memberships.map((m) => (
                <div key={m.id} className="group flex items-center gap-0.5">
                  <button onClick={() => { setScope({ orgId: m.id, locationId: null }); setOpen(false); }} className={cn(row, "min-w-0 flex-1")}>
                    <span className="grid size-5 shrink-0 place-items-center rounded bg-hover text-[11px] font-semibold">{m.initial}</span>
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    {m.id === orgId && <Check size={14} />}
                  </button>
                  {/* Straight to this Organization's settings, switching to it first. */}
                  <button onClick={() => { setScope({ orgId: m.id, locationId: null }); setOpen(false); navigate("/settings/brand"); }} aria-label={`${m.name} settings`} title={`${m.name} settings`} className="grid size-7 shrink-0 place-items-center rounded text-subtle hover:bg-hover hover:text-fg">
                    <Settings size={13} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
          </>
          <div className="my-1 border-t border-line" />
          <NavLink to="/onboarding" onClick={() => setOpen(false)} className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] text-muted hover:bg-hover"><Plus size={13} /> Add organization</NavLink>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ open, onClose, ctx }: { open: boolean; onClose: () => void; ctx: PageContext }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const flags = useFeatures();
  const access = useAccess();
  const items = useMemo(() => {
    const pages = [
      ...visibleNav(flags).flatMap((n) => n.children ?? [n]).map((i) => ({ label: i.label, hint: "Page", to: i.to })),
      ...settingsLeaves.filter((i) => { const id = i.to.split("/").pop()!; const o = settingsOwner(id); return (!o || isOn(o, flags)) && sectionAllowed(id); }).map((i) => ({ label: i.label, hint: "Settings", to: i.to })),
    ];
    const extra = [
      ...(member.plan === "agency" && isOn("sales", flags) ? [{ label: "Audit a business", hint: "Prospecting", to: "/prospects?new=audit" }] : []),
      { label: "Add organization", hint: "Setup", to: "/onboarding" },
    ];
    const kws = keywords.map((k) => ({ label: k.term, hint: "Keyword", to: `/rankings/${k.id}` }));
    const found = [...pages, ...extra, ...kws].filter((i) => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
    // Anything typed can go to Marko. It leads when nothing matches or it reads like a sentence.
    if (q.trim().length < 2 || !isOn("marko", flags)) return found;
    const askRow = { label: `Ask ${assistant()}: “${q.trim()}”`, hint: "Ask", to: "", ask: true };
    return !found.length || q.trim().split(/\s+/).length >= 3 ? [askRow, ...found] : [...found, askRow];
  }, [q, flags, access]);
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
            placeholder={`Search, or tell ${assistant()} what to do…`}
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
  const crm = useCrm();
  const flags = useFeatures();
  const access = useAccess();
  const items = visibleNav(flags);
  const marko = isOn("marko", flags) && can("marko", "use", access);
  const live = runningOf(useRuns()).length;
  const loc = useLocation();
  const kind = kindForPath(loc.pathname);
  // A page whose feature is off shows how to turn it back on instead.
  const owner = featureForPage(loc.pathname, loc.search);
  const gated = owner && !isOn(owner, flags) ? owner : null;
  // A page the role can't see says so; one it can only see gets a View only note.
  const denied = owner && !gated && !pageAllowed(loc.pathname + loc.search, access) ? owner : null;
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j" && isOn("marko") && can("marko", "use")) { e.preventDefault(); toggleAssistant(); }
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
        <NavLink to="/" aria-label={`${product()} home`} className="mr-auto flex h-7 items-center rounded-md px-2 hover:bg-hover"><Logo size={17} /></NavLink>
        <button onClick={() => setCmd(true)} aria-label="Search" title="Search (⌘K)" className={iconBtn}><Search size={15} strokeWidth={1.75} /></button>
        {marko && <button onClick={toggleAssistant} aria-label={`Ask ${assistant()}`} title={`Ask ${assistant()} (⌘J)`} className={iconBtn}><Sparkles size={15} strokeWidth={1.75} /></button>}
      </div>
      <OrgSwitcher />
      <nav className="mt-1 flex flex-1 flex-col gap-px overflow-y-auto" aria-label="Main">
        {items.map((n) => (
          <div key={n.label}>
            {n.section && <div className="mt-3 mb-0.5 px-2 text-[10.5px] font-medium tracking-[0.06em] text-subtle uppercase">{n.section}</div>}
            <NavItem item={n} badge={n.to === "/todo" ? openTasksFor(runState).length : n.to === "/inbox" ? unreadCount(crm) : undefined} open={shown(n)} onToggle={() => toggle(n)} />
          </div>
        ))}
      </nav>
      <NavLink to="/settings/websites" className="mb-1 rounded-lg border border-line bg-surface px-2.5 py-2 shadow-card transition-colors hover:border-line-strong">
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
        {/* Long working lists (Prospecting, Outreach) get the full width; reading pages stay narrow. */}
        <main className={cn("relative mx-auto w-full px-4 py-8 sm:px-8 lg:px-12 lg:py-10", /^\/(prospects|outreach|contacts|inbox|ads(\/\w+)?)$/.test(loc.pathname) ? "max-w-[1680px]" : "max-w-[1180px]")}>
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
          {access.preview && <PreviewBar />}
          {gated ? <FeatureOff id={gated} /> : denied ? <NoAccess id={denied} /> : <>{owner && viewOnly(owner, access) && <ViewOnly />}<Outlet context={ctx} /></>}
        </main>
      </div>
      {marko && <><AssistantPanel ctx={ctx} /><MarkoLauncher /></>}
      <CommandPalette open={cmd} onClose={() => setCmd(false)} ctx={ctx} />
    </div>
  );
}

/** While previewing a role from Settings → Team: what that role sees, and a way out. */
function PreviewBar() {
  const role = myRole(useAccess());
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-ink px-3 py-2 text-[13px] text-on-ink print:hidden">
      <span className="flex-1">Previewing as <b>{role.name}</b>. The sidebar, pages and buttons show what this role can do.</span>
      <Link to="/settings/team" onClick={() => setPreview(null)} className="rounded-md bg-surface/15 px-2.5 py-1 font-medium hover:bg-surface/25">Stop preview</Link>
    </div>
  );
}

/** Shown in place of a page the role can't open. */
function NoAccess({ id }: { id: Parameters<typeof featureOf>[0] }) {
  const role = myRole(useAccess());
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-hover text-muted"><Lock size={20} /></div>
      <h1 className="font-serif text-[28px]">No access to {featureOf(id).label}</h1>
      <p className="mt-2 text-[14px] text-muted">Your role ({role.name}) doesn't include it. Ask an admin on your team to change your role.</p>
    </div>
  );
}

/** Shown in place of a page whose feature is off. */
function FeatureOff({ id }: { id: Parameters<typeof featureOf>[0] }) {
  const f = featureOf(id);
  const why = statusOf(id).why;
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-hover text-muted"><Settings size={20} /></div>
      <h1 className="font-serif text-[28px]">{f.label} is off</h1>
      <p className="mt-2 text-[14px] text-muted">{why === "Turned off" ? `It's turned off for this organization. Nothing was deleted; turning it on brings everything back.` : `${why}.`}</p>
      <Link to={`/settings/features#${f.module ?? f.id}`} className="mt-5 inline-flex h-9 items-center rounded-lg bg-ink px-4 text-[13.5px] font-medium text-on-ink">Open Features</Link>
    </div>
  );
}
