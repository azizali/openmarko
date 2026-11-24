import { Button, Container, Heading, Section } from "../components/ui";
import { Faq } from "../components/sections";
import { Hero } from "../components/home/Hero";
import { AppShowcase } from "../components/home/AppShowcase";
import { BenefitGrid, ChannelRow, Problem, Steps, Testimonials, hasProof } from "../components/home/Benefits";
import { ProofStats, ProofStrip, showProof } from "../components/home/Proof";
import { APP_NAME, APP_URL } from "../data/site";
import { useTitle } from "../lib/useTitle";
import { revealDelay, useReveal } from "../lib/motion";

export default function Home() {
  useTitle(`${APP_NAME}: local SEO for Google Maps, search and AI answers`);
  // Each section's heading fades up as it comes into view, its content a beat after.
  useReveal();
  return (
    <>
      {/* Hero: the promise, the app tile, and where we check. */}
      <section className="relative overflow-hidden">
        <Hero />
        {showProof && (
          <Container rails className="relative border-t border-line py-8">
            <ProofStrip />
          </Container>
        )}
        <Container rails className="relative border-t border-line py-8">
          <p data-reveal className="mb-4 text-center text-[13px] text-subtle">
            Checked where your customers search
          </p>
          <ChannelRow />
        </Container>
      </section>

      <Section className="border-t border-line">
        <div data-reveal className="mb-12">
          <Heading title="An agency report won't show you" muted="where customers find someone else." />
        </div>
        <div data-reveal style={revealDelay(120)}>
          <Problem />
        </div>
      </Section>

      <Section id="app" className="border-t border-line bg-sunken">
        <div data-reveal className="mb-10">
          <Heading
            title="Every place you show up,"
            muted="on one screen each."
            sub="Google Maps, Google search, the AI assistants and the competitors ahead of you. Each page says when it was last checked and what changed since."
          />
        </div>
        <div data-reveal style={revealDelay(120)}>
          <AppShowcase />
        </div>
      </Section>

      <Section id="features" className="border-t border-line">
        <div data-reveal className="mb-12">
          <Heading title="Know where you lose customers," muted="and what to change this week." />
        </div>
        <BenefitGrid />
      </Section>

      <Section id="steps" className="border-t border-line bg-sunken">
        <div data-reveal className="mb-12 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <Heading title="Your first map" muted="in three steps." />
          <Button href={`${APP_URL}/sign-up`} size="lg" arrow>
            Find my business
          </Button>
        </div>
        <Steps />
      </Section>

      {(hasProof || showProof) && (
        <Section id="customers" className="border-t border-line">
          <div data-reveal className="mb-12">
            <Heading title="Owners who stopped guessing" muted="where they rank." />
          </div>
          {showProof && (
            <div data-reveal className="mb-12">
              <ProofStats />
            </div>
          )}
          {hasProof && <Testimonials />}
        </Section>
      )}

      <Section id="faq" className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div data-reveal>
            <Heading title="Questions," muted="answered." />
          </div>
          <div data-reveal style={revealDelay(120)}>
            <Faq />
          </div>
        </div>
      </Section>
    </>
  );
}
