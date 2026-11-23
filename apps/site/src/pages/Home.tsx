import { Check, MapPin } from "lucide-react";
import { Button, Container, Heading, Section } from "../components/ui";
import { Faq, FinalCta } from "../components/sections";
import { RankTile } from "../components/home/RankTile";
import { AppShowcase } from "../components/home/AppShowcase";
import { BenefitGrid, ChannelRow, Problem, Steps, Testimonials, hasProof } from "../components/home/Benefits";
import { ProofStats, ProofStrip, showProof } from "../components/home/Proof";
import { APP_NAME, APP_URL, hero } from "../data/site";
import { useTitle } from "../lib/useTitle";

export default function Home() {
  useTitle(`${APP_NAME}: local SEO for Google Maps, search and AI answers`);
  return (
    <>
      {/* Hero: the promise centred, the app's Maps page as a tile in the middle beneath it. */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 mx-auto h-[760px] max-w-[1200px]" />
        <Container rails className="relative flex flex-col items-center gap-7 pt-14 pb-16 text-center sm:pt-20 lg:pb-24">
          <span className="enter inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1.5 text-[13px] text-muted shadow-card">
            <span className="grid size-5 place-items-center rounded-full bg-accent-soft text-accent">
              <MapPin size={12} />
            </span>
            Local SEO for Google Maps, search and AI answers
          </span>
          <h1
            className="enter max-w-[16ch] font-display text-[44px] leading-[0.92] sm:text-[64px] lg:text-[80px]"
            style={{ animationDelay: "60ms" }}
          >
            {hero.title} <span className="ink-sheen">{hero.accent}</span>
          </h1>
          <p className="enter max-w-[60ch] text-[17.5px] leading-[1.6] text-fg/70 text-pretty" style={{ animationDelay: "120ms" }}>
            {hero.sub}
          </p>
          <div className="enter flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row" style={{ animationDelay: "180ms" }}>
            <Button href={`${APP_URL}/sign-up`} size="lg" arrow>
              {hero.primary}
            </Button>
            <Button href="#app" size="lg" variant="secondary">
              {hero.secondary}
            </Button>
          </div>
          <ul className="enter flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] text-muted" style={{ animationDelay: "220ms" }}>
            {hero.points.map((p) => (
              <li key={p} className="inline-flex items-center gap-1.5">
                <Check size={15} className="text-good" />
                {p}
              </li>
            ))}
          </ul>
          <div className="enter mt-4 w-full max-w-[1080px]" style={{ animationDelay: "300ms" }}>
            <RankTile />
          </div>
        </Container>
        {showProof && (
          <Container rails className="relative border-t border-line py-8">
            <ProofStrip />
          </Container>
        )}
        <Container rails className="relative border-t border-line py-8">
          <p className="mb-4 text-center text-[13px] text-subtle">Checked where your customers search</p>
          <ChannelRow />
        </Container>
      </section>

      <Section className="border-t border-line">
        <div className="mb-12">
          <Heading title="An agency report won't show you" muted="where customers find someone else." />
        </div>
        <Problem />
      </Section>

      <Section id="app" className="border-t border-line bg-sunken">
        <div className="mb-10">
          <Heading
            title="Every place you show up,"
            muted="on one screen each."
            sub="Google Maps, Google search, the AI assistants and the competitors ahead of you. Each page says when it was last checked and what changed since."
          />
        </div>
        <AppShowcase />
      </Section>

      <Section id="features" className="border-t border-line">
        <div className="mb-12">
          <Heading title="Know where you lose customers," muted="and what to change this week." />
        </div>
        <BenefitGrid />
      </Section>

      <Section id="steps" className="border-t border-line bg-sunken">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <Heading title="Your first map" muted="in three steps." />
          <Button href={`${APP_URL}/sign-up`} size="lg" arrow>
            Find my business
          </Button>
        </div>
        <Steps />
      </Section>

      {(hasProof || showProof) && (
        <Section id="customers" className="border-t border-line">
          <div className="mb-12">
            <Heading title="Owners who stopped guessing" muted="where they rank." />
          </div>
          {showProof && (
            <div className="mb-12">
              <ProofStats />
            </div>
          )}
          {hasProof && <Testimonials />}
        </Section>
      )}

      <Section id="faq" className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading title="Questions," muted="answered." />
          <Faq />
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
