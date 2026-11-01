import { Link, Navigate, useParams } from "react-router";
import { ArrowRight, Quote, Sparkles } from "lucide-react";
import { Button, Container, Heading, SampleBadge, Section, Tag } from "../components/ui";
import { GeoGrid, GridLegend } from "../components/visuals";
import { CaseStudyGrid, FinalCta, OfferBlock, TestimonialWall } from "../components/sections";
import { caseStudies, caseStudyBySlug } from "../data/stories";
import { serviceBySlug } from "../data/services";
import { SAMPLE_CONTENT } from "../data/site";
import { useTitle } from "../lib/useTitle";

function SampleNote() {
  if (!SAMPLE_CONTENT) return null;
  return <p className="max-w-[70ch] rounded-lg border border-dashed border-line-strong px-4 py-3 text-[13.5px] text-muted">These stories are illustrative samples that show how OpenMarko works. The businesses and people are fictional. Real customer stories will replace them.</p>;
}

export function Customers() {
  useTitle("Customer stories — OpenMarko");
  const [first] = caseStudies;
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[560px]" />
        <Container rails className="relative flex flex-col gap-6 pt-16 pb-14 lg:pt-24">
          <Heading as="h1" tag={<Tag icon={<Sparkles size={13} />}>Customer stories</Tag>} title="Before and after," muted="on the map." sub="How plumbers, dentists, HVAC companies and agencies moved into the map pack, and what it did for their phones." />
          <SampleNote />
        </Container>
      </section>

      <Section className="border-t border-line">
        <Link to={`/customers/${first.slug}`} className="group grid overflow-hidden rounded-3xl border border-line bg-surface transition-shadow hover:shadow-float lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 border-b border-line bg-sunken p-6 lg:border-r lg:border-b-0">
            <GeoGrid strength={first.strengthBefore} seed={2} label={`Before · #${first.rankBefore}`} />
            <GeoGrid strength={first.strengthAfter} seed={2} label={`After · #${first.rankAfter}`} />
          </div>
          <div className="flex flex-col gap-4 p-8">
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted"><span className="font-medium text-fg">{first.business}</span>· {first.city}<SampleBadge /></div>
            <h2 className="font-display text-[36px] leading-tight">{first.headline}</h2>
            <p className="text-[16px] text-muted">{first.summary}</p>
            <div className="mt-auto grid grid-cols-3 gap-4 border-t border-line pt-5">
              {first.metrics.map((m) => <div key={m.label}><div className="num font-display text-[26px] leading-none">{m.value}</div><div className="mt-1 text-[12.5px] text-muted">{m.label}</div></div>)}
            </div>
            <span className="inline-flex items-center gap-1 text-[15px] font-medium">Read the story <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </Link>
        <div className="mt-5"><CaseStudyGrid exclude={first.slug} /></div>
      </Section>

      <Section className="border-t border-line">
        <div className="mb-12"><Heading center tag={<Tag icon={<Quote size={13} />}>In their words</Tag>} title="What they say" /></div>
        <TestimonialWall />
      </Section>
      <FinalCta />
    </>
  );
}

export function CaseStudyPage() {
  const { slug = "" } = useParams();
  const s = caseStudyBySlug(slug);
  useTitle(s ? `${s.business}: ${s.headline} — OpenMarko` : "Customer stories — OpenMarko");
  if (!s) return <Navigate to="/customers" replace />;

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[600px]" />
        <Container rails className="relative flex flex-col gap-8 pt-16 pb-16 lg:pt-24">
          <Link to="/customers" className="text-[14px] text-muted hover:text-fg">← All stories</Link>
          <div className="flex flex-wrap items-center gap-2 text-[15px] text-muted"><span className="font-medium text-fg">{s.business}</span>· {s.niche} · {s.city}<SampleBadge /></div>
          <h1 className="max-w-[20ch] font-display text-[40px] leading-[1.05] sm:text-[60px]">{s.headline}</h1>
          <div className="grid border-y border-line sm:grid-cols-3">
            {s.metrics.map((m, i) => (
              <div key={m.label} className={`px-6 py-7 ${i > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}>
                <div className="num font-display text-[44px] leading-none">{m.value}</div>
                <div className="mt-2 text-[15px] text-muted">{m.label}</div>
              </div>
            ))}
          </div>
          <SampleNote />
        </Container>
      </section>

      <Section className="border-t border-line">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <Heading size="md" title={`“${s.keyword}”, before and after`} sub="Each dot is a Google Maps search from that spot. The number is where they ranked." />
          <GridLegend />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <GeoGrid strength={s.strengthBefore} seed={3} label={`Before · average #${s.rankBefore}`} />
          <GeoGrid strength={s.strengthAfter} seed={3} label={`After · average #${s.rankAfter}`} />
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading size="md" title="The challenge" />
          <p className="font-serif text-[22px] leading-snug sm:text-[26px]">{s.challenge}</p>
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading size="md" title="What changed" sub="Each step came from the To-do list, approved by the team." />
          <ol className="flex flex-col">
            {s.timeline.map((t, i) => (
              <li key={t.when} className="relative flex gap-5 pb-9 last:pb-0">
                {i < s.timeline.length - 1 && <span aria-hidden className="absolute top-3 bottom-0 left-[5px] w-px bg-line" />}
                <span className="mt-1.5 size-[11px] shrink-0 rounded-full bg-accent ring-4 ring-accent-soft" />
                <div><div className="font-mono text-[13px] text-muted">{t.when}</div><p className="mt-1 text-[16.5px]">{t.what}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section className="border-t border-line">
        <figure className="mx-auto flex max-w-[860px] flex-col items-center gap-6 text-center">
          <Quote size={28} className="text-accent" />
          <blockquote className="font-serif text-[28px] leading-snug sm:text-[36px]">“{s.quote.text}”</blockquote>
          <figcaption className="text-[15px] text-muted"><span className="font-medium text-fg">{s.quote.name}</span>, {s.quote.role}, {s.business}</figcaption>
        </figure>
      </Section>

      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading size="md" title="Results" />
          <div className="flex flex-col gap-6">
            <ul className="flex flex-col gap-3">{s.results.map((r) => <li key={r} className="border-l-2 border-accent pl-4 text-[17px]">{r}</li>)}</ul>
            <div className="flex flex-wrap gap-2">
              <span className="text-[14px] text-muted">Used:</span>
              {s.services.map((slug) => { const sv = serviceBySlug(slug); return sv && <Link key={slug} to={`/services/${slug}`} className="rounded-full border border-line px-3 py-1 text-[13.5px] hover:border-line-strong">{sv.name}</Link>; })}
            </div>
            <Button to="/#audit" arrow className="self-start">Get the same audit, free</Button>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line"><OfferBlock /></Section>

      <Section className="border-t border-line">
        <div className="mb-10"><Heading size="md" title="More stories" /></div>
        <CaseStudyGrid exclude={s.slug} limit={3} />
      </Section>
      <FinalCta />
    </>
  );
}
