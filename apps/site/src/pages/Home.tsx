import { Layers, Rocket, Sparkles } from "lucide-react";
import { Button, Container, Heading, Section, StatStrip, Tag } from "../components/ui";
import { Faq, FeatureGrid, FinalCta, HowItWorks, PricingCards } from "../components/sections";
import { APP_NAME, APP_URL, hero } from "../data/site";
import { useTitle } from "../lib/useTitle";

export default function Home() {
  useTitle(APP_NAME);
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 mx-auto h-[680px] max-w-[1200px]" />
        <Container rails className="relative flex flex-col gap-8 pt-16 pb-16 sm:pt-24 lg:pb-24">
          <Tag icon={<Rocket size={13} />}>Now in early access</Tag>
          <h1 className="max-w-[18ch] font-display text-[48px] leading-[0.92] sm:text-[60px] lg:text-[72px]">
            {hero.title}
            <br />
            <span className="text-accent">{hero.accent}</span> <span className="text-muted">{hero.muted}</span>
          </h1>
          <p className="max-w-[56ch] text-[17.5px] leading-[1.6] text-fg/70 text-pretty">{hero.sub}</p>
          <div className="flex flex-wrap gap-3">
            <Button href={`${APP_URL}/sign-up`} size="lg" arrow>
              {hero.primary}
            </Button>
            <Button to="/pricing" size="lg" variant="secondary">
              {hero.secondary}
            </Button>
          </div>
        </Container>
        <Container rails className="relative border-t border-line">
          <StatStrip
            items={[
              { value: "5", label: "optional modules, each a switch" },
              { value: "1", label: "config file to fork from" },
              { value: "200", label: "tests on the API" },
              { value: "0", label: "vendor accounts needed to start" },
            ]}
          />
        </Container>
      </section>

      <Section id="features" className="border-t border-line">
        <div className="mb-12">
          <Heading
            tag={<Tag icon={<Layers size={13} />}>What's inside</Tag>}
            title="Everything a product needs,"
            muted="before it does anything interesting."
          />
        </div>
        <FeatureGrid />
      </Section>

      <Section className="border-t border-line bg-sunken">
        <div className="mb-12">
          <Heading tag={<Tag icon={<Sparkles size={13} />}>How it works</Tag>} title="Three steps," muted="then it's your product." />
        </div>
        <HowItWorks />
      </Section>

      <Section id="pricing" className="border-t border-line">
        <div className="mb-12">
          <Heading center title="Simple pricing," muted="no contracts." sub="Placeholder plans. Edit them in one file." />
        </div>
        <PricingCards />
      </Section>

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
