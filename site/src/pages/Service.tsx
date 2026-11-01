import { Navigate, useParams } from "react-router";
import { Layers } from "lucide-react";
import { Button, Container, Heading, Section, Tag } from "../components/ui";
import { AppFrame, panelFor } from "../components/visuals";
import { CaseStudyCard, Faq, FinalCta, OfferBlock, ServicesGrid } from "../components/sections";
import { serviceIcons } from "../components/Layout";
import { serviceBySlug } from "../data/services";
import { caseStudyBySlug } from "../data/stories";
import { useTitle } from "../lib/useTitle";

export default function Service() {
  const { slug = "" } = useParams();
  const s = serviceBySlug(slug);
  useTitle(s ? `${s.name} — OpenMarko` : "OpenMarko");
  if (!s) return <Navigate to="/" replace />;
  const Icon = serviceIcons[s.slug];
  const Panel = panelFor[s.visual];
  const story = caseStudyBySlug(s.caseStudy);
  const agencies = s.audience === "agencies";

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[640px]" />
        <Container rails className="relative grid items-center gap-12 pt-16 pb-20 lg:grid-cols-[0.9fr_1.1fr] lg:pt-24">
          <div className="flex flex-col gap-7">
            <Heading as="h1" size="lg" tag={<Tag icon={<Icon size={13} />}>{s.tag}</Tag>} title={s.title} muted={s.titleMuted} sub={s.sub} />
            <div className="flex flex-wrap gap-3">
              <Button to="/#audit" size="lg" arrow>{agencies ? "Start a 7-day trial" : "Get my free audit"}</Button>
              <Button to="/pricing" size="lg" variant="secondary">Pricing</Button>
            </div>
          </div>
          <AppFrame url={`app.openmarko.com/${s.visual}`}><Panel /></AppFrame>
        </Container>
      </section>

      <Section className="border-t border-line">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {s.benefits.map((b, i) => (
            <div key={b.title} className="flex flex-col gap-3 bg-surface p-7">
              <span className="num font-mono text-[13px] text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="font-display text-[26px] leading-tight">{b.title}</h2>
              <p className="text-[15.5px] text-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading title="How it works" sub={`${s.name}, in ${s.steps.length} steps.`} />
          <ol className="flex flex-col">
            {s.steps.map((st, i) => (
              <li key={st.title} className="relative flex gap-5 pb-10 last:pb-0">
                {i < s.steps.length - 1 && <span aria-hidden className="absolute top-9 bottom-0 left-[17px] w-px bg-line" />}
                <span className="num grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[14px] font-medium text-on-ink">{i + 1}</span>
                <div className="pt-1"><h3 className="text-[19px] font-medium">{st.title}</h3><p className="mt-1 text-[15.5px] text-muted">{st.body}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {story && (
        <Section className="border-t border-line">
          <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <Heading title="See it work" sub={story.summary} />
            <CaseStudyCard s={story} />
          </div>
        </Section>
      )}

      <Section className="border-t border-line"><OfferBlock /></Section>

      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading title="Questions" muted={`about ${s.name.toLowerCase()}`} />
          <Faq items={s.faqs} />
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="mb-10"><Heading tag={<Tag icon={<Layers size={13} />}>Also in OpenMarko</Tag>} title="Works better together" /></div>
        <ServicesGrid exclude={s.slug} />
      </Section>

      <FinalCta />
    </>
  );
}
