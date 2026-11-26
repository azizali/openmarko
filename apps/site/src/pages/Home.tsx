import { Button, Heading, Section } from "../components/ui";
import { Faq } from "../components/sections";
import { Hero } from "../components/home/Hero";
import { FeatureRows, Problem, Steps, Testimonials, hasProof } from "../components/home/Benefits";
import { ProofStrip, showProof } from "../components/home/Proof";
import { Numbers, Sources, Trust } from "../components/home/Value";
import { APP_NAME } from "../data/site";
import { useTitle } from "../lib/useTitle";
import { revealDelay, useReveal } from "../lib/motion";

// Value first: the promise with the app under it, who uses it, three numbers, how it works, where customers search,
// what you get, why it's safe to let run, what owners say; the agency comparison sits low, before the questions.
export default function Home() {
  useTitle(`${APP_NAME}: more customers from Google, no agency needed`);
  // Each section's heading fades up as it comes into view, its content a beat after.
  useReveal();
  return (
    <>
      <section className="relative overflow-hidden">
        <Hero />
      </section>

      <Section roomy className="[&>div]:pt-2">
        {showProof && (
          <div className="mb-12">
            <ProofStrip />
          </div>
        )}
        <Numbers />
      </Section>

      <Section roomy id="steps" className="border-t border-line bg-sunken">
        <div data-reveal className="mx-auto mb-14 max-w-[680px]">
          <Heading
            center
            title="Getting more customers"
            muted="should be easy."
            sub="No agency to brief, no reports to read. OpenMarko learns your business and tells you what to do next."
          />
        </div>
        <div data-reveal style={revealDelay(120)}>
          <Steps />
        </div>
        <div className="mt-14 flex justify-center">
          <Button href="#try" size="lg">
            Try it free
          </Button>
        </div>
      </Section>

      <Section roomy className="border-t border-line">
        <div data-reveal className="mx-auto mb-14 max-w-[680px]">
          <Heading
            center
            title="Your next customer is already searching."
            muted="OpenMarko knows where to look."
            sub="People find a local business in five places now. We check all of them, every week."
          />
        </div>
        <Sources />
      </Section>

      <Section roomy id="features" className="border-t border-line bg-sunken">
        <div data-reveal className="mb-14 max-w-[680px]">
          <Heading title="Know where you lose customers," muted="and what to change this week." />
        </div>
        <FeatureRows />
      </Section>

      <Section roomy className="border-t border-line">
        <div data-reveal className="mx-auto mb-14 max-w-[680px]">
          <Heading center title="Every change is shown first." muted="So you can let it run." />
        </div>
        <Trust />
      </Section>

      {hasProof && (
        <Section roomy id="customers" className="border-t border-line">
          <div data-reveal className="mb-14">
            <Heading title="Owners who stopped guessing" muted="where they rank." />
          </div>
          <Testimonials />
        </Section>
      )}

      <Section roomy className="border-t border-line bg-sunken">
        <div data-reveal className="mx-auto mb-14 max-w-[680px]">
          <Heading
            center
            title="Everything an agency report"
            muted="leaves out."
            sub="Read each line across: what you get now, and what you get with OpenMarko."
          />
        </div>
        <div data-reveal style={revealDelay(120)}>
          <Problem />
        </div>
      </Section>

      <Section roomy id="faq" className="border-t border-line">
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
