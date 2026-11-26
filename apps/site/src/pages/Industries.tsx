// The industry pages: /for lists every industry by group; /for/<slug> speaks to one trade with its own searches.
// One template for all of them, filled from data/industries.ts; the map grid is the home page's drawing, with a
// fixed picture per keyword so every visit shows the same thing.
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { ArrowRight, ChevronRight, MapPin, Search, Sparkles } from "lucide-react";
import { Button, Container, Heading, Section, cn } from "../components/ui";
import { Faq } from "../components/sections";
import { GridLegend, MapGrid } from "../components/home/MapGrid";
import { engines, gridRanks, top3 } from "../components/home/mock";
import { groupOf, groups, inGroup, industryBySlug, type Industry } from "../data/industries";
import { APP_NAME, APP_URL } from "../data/site";
import { useTitle } from "../lib/useTitle";
import { revealDelay, useReveal } from "../lib/motion";

const SIZE = 7;
const article = (w: string) => (/^[aeiou]/i.test(w) && !/^u[^aeiou]/i.test(w) ? "an" : "a");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "Hair salons" → "hair salons" inside a sentence, but "HVAC companies" keeps its capitals. */
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export function IndustriesIndex() {
  useTitle(`Industries — ${APP_NAME}`);
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[560px]" />
      <Container rails className="relative flex flex-col gap-14 pt-16 pb-20 lg:pt-24">
        <Heading
          as="h1"
          title="Built for businesses"
          muted="customers find on a map."
          sub="Pick your trade to see the searches we check for it. Don't see yours? If customers find you on Google Maps, it works for you."
        />
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g) => (
            <div key={g.id} className="flex flex-col gap-3 bg-surface p-6">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
                  <g.icon size={16} />
                </span>
                <h2 className="text-[16px] font-medium">{g.label}</h2>
                <span className="num ml-auto text-[12px] text-subtle">{inGroup(g.id).length}</span>
              </div>
              <ul className="flex flex-col">
                {inGroup(g.id).map((ind) => (
                  <li key={ind.slug}>
                    <Link
                      to={`/for/${ind.slug}`}
                      className="group -mx-2 flex min-h-9 items-center justify-between rounded-md px-2 text-[15px] text-fg/80 hover:bg-hover hover:text-fg"
                    >
                      {ind.name}
                      <ChevronRight size={15} className="text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/** The hero's picture: the map for one of the industry's searches, switched by the chips above it. */
function KeywordMap({ ind }: { ind: Industry }) {
  const [pick, setPick] = useState(0);
  const ranks = gridRanks(SIZE, pick);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-float sm:p-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Searches">
        {ind.keywords.map((k, i) => (
          <button
            key={k}
            role="tab"
            aria-selected={pick === i}
            onClick={() => setPick(i)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
              pick === i ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            <Search size={12} />
            {k}
          </button>
        ))}
      </div>
      {/* Keyed by the search, so its dots spread out from the door again on every switch. */}
      <MapGrid key={pick} size={SIZE} ranks={ranks} animate />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[14px]">
          <span className="num font-medium">{top3(ranks)}</span>
          <span className="text-muted">
            {" "}
            of {SIZE * SIZE} spots in the top 3 for “{ind.keywords[pick]}”
          </span>
        </span>
        <GridLegend />
      </div>
    </div>
  );
}

const checks = (ind: Industry) => [
  {
    icon: MapPin,
    title: "Google Maps, street by street",
    body: `Your position for “${ind.keywords[0]}” and “${ind.keywords[1]}” from up to 81 spots around your door, so you see the streets where customers find another ${ind.one}.`,
  },
  {
    icon: Search,
    title: "Google search",
    body: `Where you rank for “${ind.keywords[2]}” and the rest of your searches, whether you're in the map pack, and whether Google's AI Overview names you.`,
  },
  {
    icon: Sparkles,
    title: "AI answers",
    body: `What ChatGPT, Perplexity and Google say when someone asks “${ind.question}” — whether you're named, where, and which sites they cited.`,
  },
];

const industryFaqs = (ind: Industry) => [
  {
    q: `Which searches should ${article(ind.one)} ${ind.one} track?`,
    a: `Start with the ones customers type: ${ind.keywords.map((k) => `“${k}”`).join(", ")}. We suggest more from your Google Business Profile categories and from the searches your competitors rank for.`,
  },
  {
    q: "Why does my rank change from street to street?",
    a: "Google Maps ranks businesses by where the person searching stands. A few blocks can move you from first to off the list, so we search from a grid of spots around your door and show your position at each one.",
  },
  {
    q: `Will you change my profile without asking?`,
    a: "No. Every fix waits for you to apply it, and every applied change can be undone. Autopilot stays off until you turn it on, one kind of change at a time.",
  },
  {
    q: "I have more than one location. Does that work?",
    a: "Yes. Each location gets its own grid, keywords and fixes, and you see them side by side.",
  },
];

export function IndustryPage() {
  const ind = industryBySlug(useParams().slug);
  useTitle(ind ? `Local SEO for ${lower(ind.name)} — ${APP_NAME}` : APP_NAME);
  useReveal();
  if (!ind) return <Navigate to="/for" replace />;
  const group = groupOf(ind);
  const more = inGroup(ind.group).filter((i) => i.slug !== ind.slug);
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[640px]" />
        <Container rails className="relative grid items-center gap-12 pt-10 pb-16 lg:grid-cols-[1fr_440px] lg:pt-16 lg:pb-24">
          <div className="flex flex-col gap-7">
            <nav aria-label="Breadcrumb" className="enter flex items-center gap-1.5 text-[13px] text-muted">
              <Link to="/for" className="hover:text-fg">
                Industries
              </Link>
              <ChevronRight size={13} className="text-subtle" />
              <span>{group.label}</span>
              <ChevronRight size={13} className="text-subtle" />
              <span className="text-fg">{ind.name}</span>
            </nav>
            <h1 className="enter max-w-[15ch] font-display text-[42px] leading-[0.95] sm:text-[56px] lg:text-[64px]">
              Local SEO for <span className="ink-sheen">{lower(ind.name)}.</span>
            </h1>
            <p className="enter max-w-[46ch] text-[18px] leading-[1.55] text-fg/70 text-pretty" style={{ animationDelay: "60ms" }}>
              {ind.pitch}
            </p>
            <div className="enter flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "120ms" }}>
              <Button href={`${APP_URL}/sign-up`} size="lg" arrow>
                Check my rankings
              </Button>
              <Button to="/#app" size="lg" variant="secondary">
                See the app
              </Button>
            </div>
          </div>
          <div className="enter" style={{ animationDelay: "200ms" }}>
            <KeywordMap ind={ind} />
          </div>
        </Container>
      </section>

      <Section className="border-t border-line bg-sunken">
        <div data-reveal className="mb-12">
          <Heading title={`What we check for ${lower(ind.name)},`} muted="every week." />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {checks(ind).map((c, i) => (
            <div
              key={c.title}
              data-reveal
              style={revealDelay(i * 80)}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-7"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                <c.icon size={17} />
              </span>
              <h3 className="text-[18px] font-medium">{c.title}</h3>
              <p className="text-[15px] leading-[1.6] text-muted">{c.body}</p>
            </div>
          ))}
        </div>
        <div data-reveal className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-[14px] text-muted">
          <span>Asked of</span>
          {engines.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-2 text-fg">
              <img src={e.icon} alt="" width={16} height={16} className={cn("size-4 object-contain", e.ink && "dark:invert")} />
              {e.name}
            </span>
          ))}
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div data-reveal>
            <Heading title={`${cap(ind.one)} questions,`} muted="answered." />
          </div>
          <div data-reveal style={revealDelay(120)}>
            <Faq items={industryFaqs(ind)} />
          </div>
        </div>
      </Section>

      {more.length > 0 && (
        <Section className="border-t border-line">
          <div data-reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <Heading size="md" title={`More in ${lower(group.label)}`} />
            <Link to="/for" className="group inline-flex items-center gap-1.5 text-[14px] font-medium">
              All industries
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <ul data-reveal className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {more.map((m) => (
              <li key={m.slug}>
                <Link
                  to={`/for/${m.slug}`}
                  className="group flex h-full flex-col gap-1.5 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                >
                  <span className="flex items-center justify-between text-[16px] font-medium">
                    {m.name}
                    <ArrowRight size={15} className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                  </span>
                  <span className="text-[13.5px] leading-[1.5] text-muted">{m.keywords.slice(0, 2).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
