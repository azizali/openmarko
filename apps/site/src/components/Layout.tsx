import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button, Container, cn } from "./ui";
import { APP_NAME, APP_URL, CONTACT_EMAIL } from "../data/site";

const links = [
  { to: "/#features", label: "Product" },
  { to: "/pricing", label: "Pricing" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
];

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  useEffect(() => {
    if (dark) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("site-theme", dark ? "dark" : "light");
    } catch {
      // storage blocked: this visit only
    }
  }, [dark]);
  return [dark, setDark] as const;
}

function ThemeSwitch() {
  const [dark, setDark] = useTheme();
  return (
    <button
      onClick={() => setDark(!dark)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

const YEAR = new Date().getFullYear();

function Header() {
  // Open on one path; any navigation closes it, with no effect needed.
  const loc = useLocation();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const mobile = openAt === loc.pathname;
  const setMobile = (on: boolean) => setOpenAt(on ? loc.pathname : null);
  const navCls = ({ isActive }: { isActive: boolean }) =>
    cn("inline-flex h-8 items-center rounded-md px-2.5 text-[14px]", isActive ? "text-fg" : "text-muted hover:text-fg");
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <Container className="flex h-14 items-center gap-2">
        <Link to="/" aria-label={`${APP_NAME} home`} className="mr-4 flex items-center">
          <Logo size={21} />
        </Link>
        <nav className="hidden items-center lg:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch />
          <a href={`${APP_URL}/sign-in`} className="hidden h-8 items-center px-2.5 text-[14px] text-muted hover:text-fg sm:inline-flex">
            Sign in
          </a>
          <Button href={`${APP_URL}/sign-up`} size="sm" className="hidden sm:inline-flex">
            Start free
          </Button>
          <button
            onClick={() => setMobile(!mobile)}
            aria-expanded={mobile}
            aria-label={mobile ? "Close menu" : "Open menu"}
            className="grid size-8 place-items-center rounded-md hover:bg-hover lg:hidden"
          >
            {mobile ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </Container>
      {mobile && (
        <div className="rise border-t border-line bg-bg lg:hidden">
          <Container className="flex flex-col gap-2 py-6">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="py-2 text-[16px]">
                {l.label}
              </Link>
            ))}
            <a href={`${APP_URL}/sign-in`} className="py-2 text-[16px]">
              Sign in
            </a>
            <Button href={`${APP_URL}/sign-up`} size="lg" arrow>
              Start free
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const cols = [
    {
      title: "Product",
      links: [
        { to: "/#features", label: "Features" },
        { to: "/pricing", label: "Pricing" },
        { to: "/#faq", label: "FAQ" },
      ],
    },
    {
      title: "Company",
      links: [
        { to: "/about", label: "About" },
        { to: "/blog", label: "Blog" },
      ],
    },
    {
      title: "Legal",
      links: [
        { to: "/privacy", label: "Privacy" },
        { to: "/terms", label: "Terms" },
      ],
    },
  ];
  return (
    <footer className="border-t border-line">
      <Container rails className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Logo size={24} />
          <p className="max-w-[32ch] text-[14px] text-muted">A short line about what your product does and for whom.</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[14px] text-muted hover:text-fg">
            {CONTACT_EMAIL}
          </a>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="mb-3 font-mono text-[11px] tracking-wider text-subtle uppercase">{c.title}</div>
            <ul className="flex flex-col gap-2">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-[14px] text-muted hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <Container rails className="flex flex-wrap justify-between gap-2 border-t border-line py-5 text-[13px] text-subtle">
        <span>
          © {YEAR} {APP_NAME}
        </span>
        <span>Built on the boilerplate.</span>
      </Container>
    </footer>
  );
}

/** Scrolls to the top on page change, or to #hash targets like /#features. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
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
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
