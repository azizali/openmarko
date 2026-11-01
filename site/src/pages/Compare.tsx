import { Link, Navigate, useParams } from "react-router";
import { ArrowRight, ExternalLink, Scale, ThumbsUp } from "lucide-react";
import { Button, Container, Heading, Section, Tag } from "../components/ui";
import { CompareMatrix, FinalCta, OfferBlock } from "../components/sections";
import { AS_OF, competitorBySlug, competitors } from "../data/competitors";
import { plans } from "../data/site";
import { useTitle } from "../lib/useTitle";

export function CompareIndex() {
  useTitle("Compare OpenMarko — local SEO tools side by side");
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[560px]" />
        <Container rails className="relative pt-16 pb-14 lg:pt-24">
          <Heading as="h1" tag={<Tag icon={<Scale size={13} />}>Compare</Tag>} title="Others measure the map." muted="OpenMarko changes it." sub={`An honest comparison built from each vendor's own pages, checked in ${AS_OF}. Where a competitor is stronger, we say so.`} />
        </Container>
      </section>
      <Section className="border-t border-line">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => (
            <Link key={c.slug} to={`/compare/${c.slug}`} className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6 transition-shadow hover:shadow-float">
              <span className="font-mono text-[12px] tracking-wider text-muted uppercase">{c.kind}</span>
              <span className="font-display text-[28px] leading-tight">OpenMarko vs {c.name}</span>
              <span className="text-[15px] text-muted">{c.oneLine}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[14px] font-medium">Read comparison <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </Section>
      <Section className="border-t border-line">
        <div className="mb-10"><Heading title="Feature by feature" sub="OpenMarko's gaps are listed too: we don't distribute listings or include a CRM." /></div>
        <CompareMatrix />
      </Section>
      <FinalCta />
    </>
  );
}

export function CompareDetail() {
  const { slug = "" } = useParams();
  const c = competitorBySlug(slug);
  useTitle(c ? `OpenMarko vs ${c.name} — honest comparison` : "Compare — OpenMarko");
  if (!c) return <Navigate to="/compare" replace />;

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[560px]" />
        <Container rails className="relative flex flex-col gap-8 pt-16 pb-16 lg:pt-24">
          <Link to="/compare" className="text-[14px] text-muted hover:text-fg">← All comparisons</Link>
          <Heading as="h1" tag={<Tag icon={<Scale size={13} />}>{c.kind}</Tag>} title={<>OpenMarko vs <span className="ink-sheen">{c.name}</span></>} sub={c.oneLine} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <div className="mb-2 text-[14px] text-muted">Choose {c.name} if</div>
              <p className="text-[18px]">{c.chooseThem}</p>
            </div>
            <div className="rounded-2xl border-2 border-ink bg-surface p-6">
              <div className="mb-2 text-[14px] text-muted">Choose OpenMarko if</div>
              <p className="text-[18px]">{c.chooseUs}</p>
            </div>
          </div>
        </Container>
      </section>

      <Section className="border-t border-line">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-7">
            <h2 className="flex items-center gap-2 text-[18px] font-medium"><ThumbsUp size={17} className="text-muted" /> Where {c.name} is stronger</h2>
            <ul className="flex flex-col gap-3">{c.theyWin.map((t) => <li key={t} className="border-l-2 border-line-strong pl-4 text-[15.5px]">{t}</li>)}</ul>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-7">
            <h2 className="flex items-center gap-2 text-[18px] font-medium"><ThumbsUp size={17} className="text-accent" /> Where OpenMarko is stronger</h2>
            <ul className="flex flex-col gap-3">{c.weWin.map((t) => <li key={t} className="border-l-2 border-accent pl-4 text-[15.5px]">{t}</li>)}</ul>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="mb-10"><Heading title="Feature by feature" sub={`From ${c.name}'s own pages, as of ${AS_OF}.`} /></div>
        <CompareMatrix only={c.slug} />
      </Section>

      <Section className="border-t border-line">
        <div className="mb-10"><Heading title="Pricing" /></div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-7">
            <div className="text-[14px] text-muted">{c.name}</div>
            <p className="text-[17px]">{c.pricing}</p>
            <p className="text-[15px] text-muted">{c.contract}</p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-surface p-7">
            <div className="text-[14px] text-muted">OpenMarko</div>
            <p className="text-[17px]">{plans.map((p) => `${p.name} $${p.price}/mo`).join(" · ")}. Usage credits never expire.</p>
            <p className="text-[15px] text-muted">Month-to-month, no contract. Every scan shows its real data cost.</p>
            <Button to="/pricing" variant="secondary" arrow className="mt-2 self-start">Full pricing</Button>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="mb-8"><OfferBlock /></div>
        <div className="text-[13px] text-muted">
          <div className="mb-2 font-medium text-fg">Sources, checked {AS_OF}</div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {c.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">{s.label}<ExternalLink size={12} /></a></li>)}
          </ul>
          <p className="mt-3 max-w-[80ch]">Product names are trademarks of their owners. Spotted something out of date? Tell us and we'll fix it.</p>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
