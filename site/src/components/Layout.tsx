import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { ChevronDown, Menu, X, MapPin, Wrench, Store, MessageSquare, Sparkles, Target, Moon, Sun } from "lucide-react";
import { Logo } from "./Logo";
import { Button, Container, cn } from "./ui";
import { services } from "../data/services";
import { competitors } from "../data/competitors";
import { APP_URL } from "../data/site";

export const serviceIcons = { "map-pack-tracking": MapPin, "site-fixes": Wrench, "business-profile": Store, reviews: MessageSquare, "ai-visibility": Sparkles, "agency-prospecting": Target } as Record<string, typeof MapPin>;

function Dropdown({ label, children, width = 560 }: { label: string; children: (close: () => void) => ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((v) => !v)} onMouseEnter={() => setOpen(true)} aria-expanded={open}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[14px] text-muted hover:text-fg">
        {label}<ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 pt-2" style={{ width }}>
          <div className="rise rounded-xl border border-line bg-surface p-2 shadow-float">{children(() => setOpen(false))}</div>
        </div>
      )}
    </div>
  );
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  useEffect(() => {
    if (dark) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("om-theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  return [dark, setDark] as const;
}

function ThemeSwitch() {
  const [dark, setDark] = useTheme();
  return (
    <button onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function Header() {
  const [mobile, setMobile] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobile(false), [loc.pathname]);
  const navCls = ({ isActive }: { isActive: boolean }) => cn("inline-flex h-8 items-center rounded-md px-2.5 text-[14px]", isActive ? "text-fg" : "text-muted hover:text-fg");
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <Container className="flex h-14 items-center gap-2">
        <Link to="/" aria-label="OpenMarko home" className="mr-4 flex items-center"><Logo size={21} /></Link>
        <nav className="hidden items-center lg:flex" aria-label="Main">
          <Dropdown label="Product">
            {() => (
              <div className="grid grid-cols-2 gap-1">
                {services.map((s) => {
                  const Icon = serviceIcons[s.slug];
                  return (
                    <Link key={s.slug} to={`/services/${s.slug}`} className="flex gap-3 rounded-lg p-3 hover:bg-hover">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={17} /></span>
                      <span><span className="block text-[14px] font-medium">{s.name}</span><span className="line-clamp-2 block text-[13px] text-muted">{s.short}</span></span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Dropdown>
          <Dropdown label="Compare" width={300}>
            {() => (
              <div className="flex flex-col">
                {competitors.map((c) => (
                  <Link key={c.slug} to={`/compare/${c.slug}`} className="rounded-lg px-3 py-2 text-[14px] hover:bg-hover">OpenMarko vs {c.name}</Link>
                ))}
                <Link to="/compare" className="mt-1 rounded-lg border-t border-line px-3 py-2 text-[13px] text-muted hover:bg-hover">All comparisons</Link>
              </div>
            )}
          </Dropdown>
          <NavLink to="/customers" className={navCls}>Customers</NavLink>
          <NavLink to="/pricing" className={navCls}>Pricing</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch />
          <a href={APP_URL} className="hidden h-8 items-center px-2.5 text-[14px] text-muted hover:text-fg sm:inline-flex">Sign in</a>
          <Button to="/#audit" size="sm" className="hidden sm:inline-flex">Free audit</Button>
          <button onClick={() => setMobile((v) => !v)} aria-expanded={mobile} aria-label={mobile ? "Close menu" : "Open menu"} className="grid size-8 place-items-center rounded-md hover:bg-hover lg:hidden">
            {mobile ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </Container>
      {mobile && (
        <div className="rise max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line bg-bg lg:hidden">
          <Container className="flex flex-col gap-6 py-6">
            <div><div className="mb-2 font-mono text-[11px] tracking-wider text-subtle uppercase">Product</div>
              {services.map((s) => <Link key={s.slug} to={`/services/${s.slug}`} className="block py-2 text-[16px]">{s.name}</Link>)}</div>
            <div><div className="mb-2 font-mono text-[11px] tracking-wider text-subtle uppercase">Compare</div>
              {competitors.map((c) => <Link key={c.slug} to={`/compare/${c.slug}`} className="block py-2 text-[16px]">vs {c.name}</Link>)}</div>
            <div className="flex flex-col"><Link to="/customers" className="py-2 text-[16px]">Customers</Link><Link to="/pricing" className="py-2 text-[16px]">Pricing</Link><a href={APP_URL} className="py-2 text-[16px]">Sign in</a></div>
            <Button to="/#audit" size="lg" arrow>Get my free audit</Button>
          </Container>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const cols = [
    { title: "Product", links: services.map((s) => ({ to: `/services/${s.slug}`, label: s.name })) },
    { title: "Compare", links: competitors.map((c) => ({ to: `/compare/${c.slug}`, label: `vs ${c.name}` })) },
    { title: "Company", links: [{ to: "/customers", label: "Customers" }, { to: "/pricing", label: "Pricing" }, { to: "/#audit", label: "Free audit" }, { to: "/services/agency-prospecting", label: "For agencies" }] },
  ];
  return (
    <footer className="border-t border-line">
      <Container rails className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Logo size={24} />
          <p className="max-w-[32ch] text-[14px] text-muted">The anti-agency. Marko does your marketing, you approve it.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="mb-3 font-mono text-[11px] tracking-wider text-subtle uppercase">{c.title}</div>
            <ul className="flex flex-col gap-2">{c.links.map((l) => <li key={l.to}><Link to={l.to} className="text-[14px] text-muted hover:text-fg">{l.label}</Link></li>)}</ul>
          </div>
        ))}
      </Container>
      <Container rails className="flex flex-wrap justify-between gap-2 border-t border-line py-5 text-[13px] text-subtle">
        <span>© {new Date().getFullYear()} OpenMarko</span>
        <span>Google, Google Maps and Google Business Profile are trademarks of Google LLC.</span>
      </Container>
    </footer>
  );
}

/** Scrolls to the top on page change, or to #hash targets like /#audit. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      <Header />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}
