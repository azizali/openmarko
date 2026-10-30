import { Link } from "react-router";
import { ArrowRight, Calculator, Layers, MapPin, Quote, Scale, Sparkles, Target, Workflow } from "lucide-react";
import { Button, Container, Heading, PixelBand, Section, StatStrip, Tag } from "../components/ui";
import { AuditViewedToast, HeroProduct, ProspectPanel, AppFrame } from "../components/visuals";
import { AuditForm, CaseStudyGrid, CompareMatrix, Faq, FeatureTrio, FinalCta, HowItWorks, IndustriesMarquee, OfferBlock, RoiCalculator, ServicesGrid, TestimonialWall } from "../components/sections";
import { stats } from "../data/site";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[760px]" />
        <Container rails className="relative flex flex-col items-center gap-8 pt-16 pb-20 text-center sm:pt-24">
          <Link to="/services/ai-visibility" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-[13.5px] shadow-card hover:border-line-strong">
            <span className="rounded-full bg-ink px-2 py-0.5 text-[12px] font-medium text-on-ink">New</span>
            AI search visibility, on the same keywords
            <ArrowRight size={14} />
          </Link>
          <h1 className="max-w-[16ch] font-serif text-[48px] leading-[1.02] font-normal sm:text-[72px] lg:text-[84px]">
            Get into the <span className="ink-sheen">top 3</span> on Google Maps.
          </h1>
          <p className="max-w-[58ch] text-[18px] text-muted sm:text-[19px]">
            OpenMarko scans the map around your business, shows exactly why competitors outrank you, then does the fixes with your approval: Google posts, review replies and your website.
          </p>
          <div id="audit" className="w-full scroll-mt-28"><AuditForm /></div>
          <p className="text-[14px] text-muted">Run an agency? <Link to="/services/agency-prospecting" className="font-medium text-fg underline underline-offset-4">Find and sign local clients instead</Link></p>
          <div className="mt-8 w-full max-w-[1080px] text-left"><HeroProduct /></div>
        </Container>
      </section>

      <div className="border-y border-line"><Container rails className="py-10"><IndustriesMarquee /></Container></div>

      <Container rails className="py-0"><StatStrip items={stats.map((s) => ({ value: s.value, label: <>{s.label} <a href={s.url} target="_blank" rel="noreferrer" className="block pt-1 text-[12px] text-subtle underline-offset-2 hover:underline">{s.source}</a></> }))} /></Container>

      {/* How it works */}
      <Section id="how">
        <div className="mb-12"><Heading tag={<Tag icon={<Workflow size={13} />}>How it works</Tag>} title="Ranking higher should be easy." muted="Now it is." sub="No reports to decode and no agency retainer. OpenMarko learns your market, finds what's holding you back, and fixes it." /></div>
        <HowItWorks />
      </Section>

      <PixelBand />

      {/* Feature trio */}
      <Section>
        <div className="mb-12"><Heading tag={<Tag icon={<Sparkles size={13} />}>On autopilot</Tag>} title="The weekly work Google rewards," muted="done while you work." /></div>
        <FeatureTrio />
      </Section>

      {/* Services */}
      <Section className="border-t border-line">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <Heading tag={<Tag icon={<Layers size={13} />}>Everything in one place</Tag>} title="Every lever the map pack rewards" />
          <Button to="/pricing" variant="secondary" arrow>See pricing</Button>
        </div>
        <ServicesGrid />
      </Section>

      {/* Agencies */}
      <section className="border-y border-line bg-sunken">
        <Container rails className="grid items-center gap-12 py-24 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col gap-6">
            <Heading tag={<Tag icon={<Target size={13} />}>For agencies</Tag>} title="Find the businesses losing the map pack." muted="Send proof. Sign them." sub="Search a keyword and a radius. OpenMarko scores every business by how easy it is to sell, finds the owner, and builds a shareable audit with their missed revenue. When they sign, the audit becomes their To-do." />
            <ul className="grid gap-3 sm:grid-cols-3">
              {[["Ease-of-sale scores", "Rank #4–15, good ratings, no agency"], ["Audit links", "See who opened them, and how often"], ["No re-onboarding", "The audit's plan becomes the work"]].map(([t, b]) => (
                <li key={t} className="rounded-xl border border-line bg-surface p-4"><div className="text-[15px] font-medium">{t}</div><div className="text-[13.5px] text-muted">{b}</div></li>
              ))}
            </ul>
            <Button to="/services/agency-prospecting" arrow className="self-start">See prospecting</Button>
          </div>
          <div className="relative pb-10">
            <AppFrame url="app.openmarko.com/prospects"><ProspectPanel /></AppFrame>
            <AuditViewedToast className="absolute right-2 -bottom-2 sm:-right-4" />
          </div>
        </Container>
      </section>

      {/* ROI */}
      <Section id="roi">
        <div className="mb-12"><Heading tag={<Tag icon={<Calculator size={13} />}>Return on investment</Tag>} title="What is #3 worth to you?" muted="Do the math." sub="Moving from page two of the map to the top 3 changes how many people even see you. Drag the sliders to estimate it for your business." /></div>
        <RoiCalculator />
      </Section>

      {/* Case studies */}
      <Section className="border-t border-line">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <Heading tag={<Tag icon={<MapPin size={13} />}>Results</Tag>} title="Before and after," muted="on the map." />
          <Button to="/customers" variant="secondary" arrow>All stories</Button>
        </div>
        <CaseStudyGrid limit={3} />
      </Section>

      {/* Testimonials */}
      <Section className="border-t border-line">
        <div className="mb-12"><Heading center tag={<Tag icon={<Quote size={13} />}>In their words</Tag>} title="Owners and agencies," muted="out of the dashboard business." /></div>
        <TestimonialWall />
      </Section>

      {/* Comparison */}
      <Section className="border-t border-line">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <Heading tag={<Tag icon={<Scale size={13} />}>Compare</Tag>} title="Others measure the map." muted="OpenMarko changes it." sub="An honest look at what each tool does, from the vendors' own pages. Where they're stronger, we say so." />
          <Button to="/compare" variant="secondary" arrow>Detailed comparisons</Button>
        </div>
        <CompareMatrix />
      </Section>

      {/* Offer */}
      <Section className="border-t border-line"><OfferBlock /></Section>

      {/* FAQ */}
      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading title="Questions," muted="answered." sub="Anything else? Your free audit comes with a 15-minute walkthrough." />
          <Faq />
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
