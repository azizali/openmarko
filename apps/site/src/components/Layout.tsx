import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button, Container, cn } from "./ui";
import { IndustriesMenu } from "./IndustriesMenu";
import { FinalCta } from "./sections";
import { featured } from "../data/industries";
import { APP_NAME, APP_URL, CONTACT_EMAIL } from "../data/site";

const links = [
  { to: "/#app", label: "Product" },
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
      className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg"
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
  // The line under the header shows only once the page has scrolled.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const setMobile = (on: boolean) => setOpenAt(on ? loc.pathname : null);
  const navCls = ({ isActive }: { isActive: boolean }) =>
    cn("inline-flex h-[38px] items-center rounded-lg px-2.5 text-[14.5px]", isActive ? "text-fg" : "text-muted hover:text-fg");
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-bg/82 backdrop-blur transition-colors",
        scrolled || mobile ? "border-line" : "border-transparent",
      )}
    >
      <Container className="flex h-16 items-center gap-2">
        <Link to="/" aria-label={`${APP_NAME} home`} className="mr-5 flex items-center">
          <Logo size={22} />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.slice(0, 1).map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls}>
              {l.label}
            </NavLink>
          ))}
          <IndustriesMenu />
          {links.slice(1).map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch />
          <a
            href={`${APP_URL}/sign-in`}
            className="hidden h-[38px] items-center px-2.5 text-[14.5px] text-muted hover:text-fg sm:inline-flex"
          >
            Sign in
          </a>
          <Button href={`${APP_URL}/sign-up`} size="sm" className="hidden sm:inline-flex">
            Try it free
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
            {[links[0]!, { to: "/for", label: "Industries" }, ...links.slice(1)].map((l) => (
              <Link key={l.to} to={l.to} className="py-2 text-[16px]">
                {l.label}
              </Link>
            ))}
            <a href={`${APP_URL}/sign-in`} className="py-2 text-[16px]">
              Sign in
            </a>
            <Button href={`${APP_URL}/sign-up`} size="lg" arrow>
              Try it free
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}

/** Asks an assistant to read the site and sum up the product: the footer's "Ask AI about us" links. */
const summaryPrompt = () =>
  `Read ${window.location.origin} and summarise what ${APP_NAME} does for a local business, who it is for, and how it works.`;
const assistants = [
  { name: "Perplexity", icon: "/icons/perplexity.svg", url: (q: string) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}` },
  { name: "ChatGPT", icon: "/icons/openai.svg", url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { name: "Claude", icon: "/icons/claude.svg", url: (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
];

const footerCols = [
  {
    title: "Product",
    links: [
      { to: "/#app", label: "The app" },
      { to: "/#features", label: "Why owners use it" },
      { to: "/#steps", label: "How it works" },
      { to: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Industries",
    links: [...featured.map((i) => ({ to: `/for/${i.slug}`, label: i.name })), { to: "/for", label: "All industries" }],
  },
  {
    title: "Resources",
    links: [
      { to: "/blog", label: "Blog" },
      { to: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { href: `mailto:${CONTACT_EMAIL}`, label: "Contact" },
      { href: `${APP_URL}/sign-in`, label: "Sign in" },
    ],
  },
];

/** A dark band, the same on every page: the brand and its AI-summary links, then the link columns, then copyright and legal. */
function Footer() {
  const link = "inline-flex min-h-7 items-center text-[14px] text-white/60 transition-colors hover:text-white";
  return (
    <footer className="bg-band text-white">
      <Container className="grid gap-12 pt-16 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo size={22} />
          <p className="max-w-[30ch] text-[14px] text-white/60">See where you rank on Google Maps, street by street.</p>
          <div className="mt-4 flex flex-col gap-3">
            <span className="text-[14px] font-medium">Ask AI about {APP_NAME}</span>
            <div className="flex gap-2">
              {assistants.map((a) => (
                <a
                  key={a.name}
                  href={a.url(summaryPrompt())}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Ask ${a.name} to summarise ${APP_NAME}`}
                  title={a.name}
                  className="grid size-11 place-items-center rounded-lg opacity-70 transition-[opacity,transform] hover:-translate-y-0.5 hover:opacity-100"
                >
                  <img src={a.icon} alt="" width={24} height={24} className="size-6 object-contain brightness-0 invert" />
                </a>
              ))}
            </div>
          </div>
        </div>
        {footerCols.map((c) => (
          <div key={c.title}>
            <div className="mb-3 text-[14px] font-medium">{c.title}</div>
            <ul className="flex flex-col gap-1">
              {c.links.map((l) => (
                <li key={l.label}>
                  {"to" in l && l.to ? (
                    <Link to={l.to} className={link}>
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className={link}>
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <Container>
        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-[13px] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {YEAR} {APP_NAME}. Google, ChatGPT, Perplexity and Claude are trademarks of their owners.
          </span>
          <span className="flex gap-5">
            <Link to="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-white">
              Privacy policy
            </Link>
          </span>
        </div>
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
      {/* Every page closes the same way: the call to action opening into the footer. */}
      <FinalCta />
      <Footer />
    </div>
  );
}
