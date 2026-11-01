import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button, Container, Heading, SampleBadge, Section } from "../components/ui";
import { AiPanel, AppFrame, MapPanel, ReportPanel, ReviewsPanel } from "../components/visuals";
import { AgencyReport, AutopilotPanel, BacklinksPanel, CitationsPanel, CompetitorPanel, PresenceStrip, SerpMock, ServiceAreaPanel, SiteAuditPanel, Strike, Versus, PackBeforeAfter, LiveDot, LiveJoin, OwnersStrip, VideoCard, jobIcons, useActiveStep, useInView } from "../components/marko";
import { AuditForm, Faq, OfferBlock } from "../components/sections";
import { BannerCapture, FollowAlong, Mine, PersonaChip, PersonaProvider, PreviewNote, TradePicker, followAlong, usePersona } from "../components/persona";
import { fill } from "../data/persona";
import { caseStudies, testimonials, videoTestimonials } from "../data/stories";
import { traction } from "../data/site";
import { agencyPains, endPresence, faqs, finalCta, hero, jobs, savings, type Job } from "../data/antiAgency";

const panels: Record<Job["id"], { url: string; panel: () => ReactNode }> = {
  competitors: { url: "competitors", panel: () => <CompetitorPanel /> },
  reviews: { url: "reviews", panel: () => <ReviewsPanel /> },
  profile: { url: "rankings", panel: () => <MapPanel strength={0.7} /> },
  audit: { url: "audit", panel: () => <SiteAuditPanel /> },
  pages: { url: "content/pages", panel: () => <ServiceAreaPanel /> },
  links: { url: "citations/backlinks", panel: () => <BacklinksPanel /> },
  ai: { url: "ai", panel: () => <AiPanel /> },
  citations: { url: "citations", panel: () => <CitationsPanel /> },
  report: { url: "reports", panel: () => <ReportPanel /> },
};

export default function Home() {
  return <PersonaProvider><HomeBody /></PersonaProvider>;
}

function HomeBody() {
  const me = usePersona().p;
  return (
    <>
      <Hero />
      <BannerCapture />
      <Problem />
      <Story />
      <Proof />
      <Control />
      <VersusSection />
      <Section className="border-t border-line"><OfferBlock /></Section>
      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading title="Questions," muted="answered." sub="Anything else? Here is what owners ask most." />
          <Faq items={faqs.map((f) => ({ ...f, a: fill(f.a, me) }))} />
        </div>
      </Section>
      <FinalCta />
      <PersonaChip />
      <TradePicker />
    </>
  );
}

function Hero() {
  const me = usePersona().p;
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 mx-auto h-[680px] max-w-[1200px]" />
      <Container rails className="relative grid items-start gap-12 pt-8 pb-16 sm:pt-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6 lg:pt-3">
          <p className="text-[15px] text-muted"><b className="num font-medium text-fg">{traction.businesses.toLocaleString()}</b> local businesses run their marketing on Marko</p>
          <h1 className="font-display text-[48px] leading-[0.92] sm:text-[60px] lg:text-[68px]">
            {hero.title}<br /><span className="text-accent">{hero.accent}</span> <span className="text-muted">{hero.muted}</span>
          </h1>
          <p className="max-w-[52ch] text-[17.5px] leading-[1.6] text-fg/70 text-pretty">
            Marko gets {me.named ? <Mine>{me.name}</Mine> : "you"} found in the three places customers{me.located && <> in <Mine>{me.city}</Mine></>} look:{" "}
            {hero.places.map((p, i) => <span key={p}><a href="#how" className="mark-line">{p}</a>{i === 0 ? ", " : i === 1 ? " and " : ". "}</span>)}
            {hero.sub}
          </p>
          <div id="audit" className="flex w-full max-w-xl scroll-mt-24 flex-col gap-3 [&_form]:mx-0">
            <AuditForm />
            <p className="flex items-center gap-2.5 text-[14px] text-muted">
              <LiveDot />
              <span><b className="num font-medium text-fg">{traction.auditsLastWeek.toLocaleString()}</b> audits sent last week</span>
              <SampleBadge />
            </p>
          </div>
        </div>
        <div className="w-full min-w-0">
          <FollowAlong />
          <SerpMock p={endPresence} labels className="mx-auto w-full max-w-[480px]" />
          <PreviewNote />
        </div>
      </Container>
      <Container rails className="relative border-t border-line py-6">
        <OwnersStrip usedBy={traction.usedBy} badge={<SampleBadge />} live={<LiveJoin joins={traction.recentJoins} />} />
      </Container>
    </section>
  );
}

function Problem() {
  const me = usePersona().p;
  const [ref, inView] = useInView<HTMLUListElement>();
  return (
    <section className="border-y border-line bg-sunken">
      <Container rails className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          <Heading title="You hired an agency." muted="You got a PDF." sub={<>Small businesses pay agencies thousands a month and still <span className="mark-line">can't say what changed</span>. Sound familiar?</>} />
          <ul ref={ref} className="flex flex-col divide-y divide-line border-y border-line">
            {agencyPains.map((p, i) => (
              <li key={p.line} className="flex flex-col gap-0.5 py-3.5">
                <span className="font-display text-[22px] leading-[1.05] font-bold sm:text-[26px]"><Strike on={inView} delay={150 + i * 220}>{fill(p.line, me)}</Strike></span>
                <span className="text-[14.5px] text-muted">{p.note}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex justify-center py-4">
          <AgencyReport />
        </div>
      </Container>
    </section>
  );
}

function JobCopy({ job }: { job: Job }) {
  const me = usePersona().p;
  const Icon = jobIcons[job.id];
  const [ref, inView] = useInView<HTMLDivElement>("0px 0px -35% 0px");
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={17} /></span>
      <h3 className="font-display text-[28px] leading-[0.98] sm:text-[34px]">{job.title}<br /><span className="text-muted">{job.muted}</span></h3>
      <p className="max-w-[52ch] text-[16px] leading-[1.6] text-fg/70 text-pretty">{fill(job.body, me)}</p>
      <p className="text-[14px]"><span className="mr-2 font-medium">Agency:</span><Strike on={inView} delay={250}>{job.agency}</Strike></p>
      {job.stat && (
        <p className="flex items-baseline gap-3 border-t border-line pt-3 text-[13.5px] text-muted">
          <span className="num font-display text-[24px] leading-none text-fg">{job.stat.value}</span>
          <span>{job.stat.label} <span className="text-subtle">· {job.stat.source}</span></span>
        </p>
      )}
    </div>
  );
}

/** The scoreboard sticks beside the jobs and turns green as each one lands. */
function Story() {
  const me = usePersona().p;
  const [active, bind] = useActiveStep(jobs.length);
  const job = jobs[active];
  return (
    <Section id="how">
      <div className="mb-14 max-w-[680px]">
        <Heading title="From page three" muted={<>to <span className="text-accent">all three</span> places.</>} sub={`One search, three ways to win it: the AI answer, the map pack and the results below. Follow ${followAlong(me)} on “${me.keyword}”, starting before Marko. Scroll to watch the work land.`} />
      </div>
      <div className="sticky top-[60px] z-30 -mx-1 mb-8 lg:hidden"><PresenceStrip p={job.after} /></div>
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] [&>*]:min-w-0">
        <div className="hidden lg:block">
          <div className="sticky top-20"><SerpMock p={job.after} focus={job.channel} /></div>
        </div>
        <div className="flex flex-col gap-24">
          {jobs.map((j, i) => (
            <article key={j.id} {...bind(i)} className="flex flex-col gap-6">
              <JobCopy job={j} />
              <AppFrame url={`app.openmarko.com/${panels[j.id].url}`}>{panels[j.id].panel()}</AppFrame>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Proof() {
  const owners = caseStudies.filter((c) => c.audience === "owners" && c.rivals);
  return (
    <Section className="border-t border-line">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <Heading title="Owners who fired their agency." muted={<><span className="text-accent">Before and after</span>, on the map.</>} sub="Same keyword, same town. The map pack before Marko, and after." />
        <Button to="/customers" variant="secondary" size="sm" arrow>All stories</Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {owners.map((c) => (
          <Link key={c.slug} to={`/customers/${c.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-float">
            <PackBeforeAfter business={c.business} keyword={c.keyword} niche={c.niche} city={c.city} rivals={c.rivals!} rankBefore={c.rankBefore} rankAfter={c.rankAfter} metric={c.metrics[0]} badge={<SampleBadge />} />
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13.5px]"><span className="line-clamp-1 text-muted">{c.headline}</span><span className="inline-flex shrink-0 items-center gap-1 font-medium">Read <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span></div>
          </Link>
        ))}
      </div>
      <div className="mt-16 mb-8"><Heading size="md" title="In their own words." /></div>
      <div className="grid gap-5 md:grid-cols-3">
        {videoTestimonials.map((v) => <VideoCard key={v.name} v={v} badge={<SampleBadge />} />)}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {testimonials.filter((t) => !["Bright Pine Digital", "Whitfield Local"].includes(t.business)).map((t) => (
          <figure key={t.name} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
            <blockquote className="font-serif text-[17px] leading-snug">“{t.text}”</blockquote>
            <figcaption className="mt-auto flex flex-col gap-1.5 text-[13px]"><span><span className="font-medium">{t.name}</span><span className="block text-muted">{t.role}, {t.business}</span></span><SampleBadge className="self-start" /></figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

function Control() {
  return (
    <Section className="border-t border-line">
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Heading title={<><span className="text-accent">Marko</span> asks first.</>} muted="You stay the boss." sub={<><span className="mark-line">Nothing goes live without your OK.</span> When you trust Marko with something, like thank-you replies to five-star reviews, switch it to Autopilot. Switch it back any time.</>} />
        <AppFrame url="app.openmarko.com/settings/autopilot"><AutopilotPanel /></AppFrame>
      </div>
    </Section>
  );
}

function VersusSection() {
  const yearly = (savings.agencyMonthly - savings.markoMonthly) * 12;
  return (
    <Section className="border-t border-line">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-8">
        <Heading title={<>Agency, or <span className="text-accent">Marko</span>?</>} muted="Not a hard choice." />
        <div className="flex flex-col gap-1 sm:text-right">
          <span className="num font-display text-[36px] leading-none">${yearly.toLocaleString()}</span>
          <span className="max-w-[34ch] text-[13.5px] text-muted">a year back in your pocket, against a typical ${savings.agencyMonthly.toLocaleString()}/mo retainer</span>
        </div>
      </div>
      <Versus />
    </Section>
  );
}

function FinalCta() {
  const me = usePersona().p;
  return (
    <section className="relative overflow-hidden border-t border-line">
      <div aria-hidden className="grid-backdrop absolute inset-y-0 inset-x-0 mx-auto max-w-[1200px]" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
        <h2 className="font-display text-[36px] leading-[0.95] sm:text-[48px]">{finalCta.title}<br /><span className="text-accent">Marko</span> <span className="text-muted">{finalCta.muted}</span></h2>
        <p className="max-w-[56ch] text-[16px] text-muted">{!me.named ? finalCta.sub : `See where ${me.name} shows up on Maps, Google and AI in ${me.city}, who's taking your calls, and the work Marko would do this week.`}</p>
        <AuditForm />
      </div>
    </section>
  );
}
