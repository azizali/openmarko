import { Link } from "react-router";
import { Calculator, Receipt } from "lucide-react";
import { Container, Heading, Section, Tag } from "../components/ui";
import { Faq, FinalCta, OfferBlock, PricingCards, RoiCalculator } from "../components/sections";
import { competitors } from "../data/competitors";
import { useTitle } from "../lib/useTitle";

const pricingFaqs = [
  { q: "What counts as a location?", a: "One Google Business Profile. Each location gets its own map grid, To-do and report." },
  { q: "What are usage credits?", a: "Scans, audits and contact lookups draw on credits. Each one shows its real data cost before it runs, and unused credits never expire." },
  { q: "Can I switch plans?", a: "Any time. Upgrades apply straight away, downgrades at the end of the month." },
  { q: "How does the 60-day guarantee work?", a: "Pick your main keyword when you start. If your map-pack rank for it hasn't improved after 60 days, email us and we'll refund both months." },
];

export default function Pricing() {
  useTitle("Pricing — OpenMarko");
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 h-[560px]" />
        <Container rails className="relative flex flex-col gap-12 pt-16 pb-20 lg:pt-24">
          <Heading as="h1" center tag={<Tag icon={<Receipt size={13} />}>Pricing</Tag>} title="Simple pricing," muted="no contracts." sub="Flat monthly plans, unlimited team members, and credits that never expire. Every scan shows what it really cost." />
          <PricingCards />
          <p id="contact" className="text-center text-[14px] text-muted">More than 30 locations? Email <span className="font-medium text-fg select-all">sales@openmarko.com</span> for a custom plan.</p>
        </Container>
      </section>

      <Section className="border-t border-line"><OfferBlock /></Section>

      <Section className="border-t border-line">
        <div className="mb-12"><Heading tag={<Tag icon={<Calculator size={13} />}>Return on investment</Tag>} title="One extra job a month" muted="usually pays for it." /></div>
        <RoiCalculator />
      </Section>

      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Heading title="Pricing questions" sub={<>Comparing costs? See how we stack up against {competitors.map((c, i) => <span key={c.slug}>{i > 0 && (i === competitors.length - 1 ? " and " : ", ")}<Link to={`/compare/${c.slug}`} className="text-fg underline underline-offset-4">{c.name}</Link></span>)}.</>} />
          <Faq items={pricingFaqs} />
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
