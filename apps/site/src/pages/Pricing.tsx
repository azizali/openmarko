import { Container, Heading, Section } from "../components/ui";
import { Faq, PricingCards } from "../components/sections";
import { APP_NAME, CONTACT_EMAIL } from "../data/site";
import { useTitle } from "../lib/useTitle";

const pricingFaqs = [
  { q: "Can I switch plans?", a: "Any time. Upgrades apply straight away, downgrades at the end of the month." },
  {
    q: "What happens past my limits?",
    a: "Each plan says: some meters pause until next month, others charge per unit. You see both before you choose.",
  },
  { q: "Do you offer a trial?", a: "The Free plan is the trial: every feature, with limits, for as long as you like." },
];

export default function Pricing() {
  useTitle(`Pricing — ${APP_NAME}`);
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[560px]" />
        <Container rails className="relative flex flex-col gap-12 pt-16 pb-20 lg:pt-24">
          <Heading
            as="h1"
            center
            title="Simple pricing,"
            muted="no contracts."
            sub="Flat monthly plans and usage you can see. Placeholder numbers: edit them in one file."
          />
          <PricingCards />
          <p className="text-center text-[14px] text-muted">
            Something bigger? Email <span className="font-medium text-fg select-all">{CONTACT_EMAIL}</span>.
          </p>
        </Container>
      </section>
      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading title="Pricing questions" />
          <Faq items={pricingFaqs} />
        </div>
      </Section>
    </>
  );
}
