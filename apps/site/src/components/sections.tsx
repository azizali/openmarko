import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, CheckList, Container, Heading, cn } from "./ui";
import { APP_URL, CONTACT_EMAIL, faqs as defaultFaqs, features, plans, steps } from "../data/site";

export function FeatureGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f, i) => (
        <div key={f.title} className="flex flex-col gap-2 bg-surface p-7">
          <span className="num font-mono text-[12px] text-subtle">0{i + 1}</span>
          <h3 className="text-[18px] font-medium">{f.title}</h3>
          <p className="text-[15px] leading-[1.6] text-muted">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

export function HowItWorks() {
  return (
    <ol className="grid gap-8 lg:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="flex flex-col gap-3 border-t border-line pt-5">
          <span className="font-display text-[40px] leading-none text-accent">{i + 1}</span>
          <h3 className="text-[18px] font-medium">{s.title}</h3>
          <p className="text-[15px] leading-[1.6] text-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function PricingCards() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((p) => (
        <div
          key={p.id}
          className={cn(
            "flex flex-col gap-5 rounded-2xl border p-7",
            p.featured ? "border-ink bg-surface shadow-float" : "border-line bg-surface",
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-medium">{p.name}</h3>
              {p.featured && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">Most popular</span>
              )}
            </div>
            <p className="mt-1 text-[14px] text-muted">{p.for}</p>
          </div>
          <div className="font-display text-[44px] leading-none">
            {p.price === null ? "Custom" : p.price === 0 ? "Free" : `$${p.price}`}
            {p.price ? <span className="text-[16px] text-muted">{p.cadence}</span> : null}
          </div>
          <CheckList items={p.features} />
          <Button
            href={p.id === "partner" ? `mailto:${CONTACT_EMAIL}` : `${APP_URL}/sign-up`}
            variant={p.featured ? "primary" : "secondary"}
            className="mt-auto"
            arrow
          >
            {p.cta}
          </Button>
        </div>
      ))}
    </div>
  );
}

export function Faq({ items = defaultFaqs }: { items?: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((f, i) => (
        <li key={f.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-4 py-4 text-left text-[16.5px] font-medium"
          >
            {f.q}
            <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", open === i && "rotate-180")} />
          </button>
          {open === i && <p className="rise pb-5 text-[15.5px] leading-[1.65] text-muted">{f.a}</p>}
        </li>
      ))}
    </ul>
  );
}

export function FinalCta() {
  return (
    <section className="relative bg-band text-white">
      <div aria-hidden className="grid-band absolute inset-0" />
      <Container className="relative flex flex-col items-start gap-6 pt-20 pb-16 sm:pt-24 lg:flex-row lg:items-center lg:justify-between">
        <Heading
          title="See your map this week."
          muted={<span className="text-white/50">Your first check runs the minute you find your business.</span>}
        />
        <div className="flex flex-wrap gap-3">
          <Button href={`${APP_URL}/sign-up`} size="lg" variant="inverse" arrow>
            Check my rankings
          </Button>
          <Button href={`mailto:${CONTACT_EMAIL}`} size="lg" variant="ghost" className="text-white hover:bg-white/10">
            Talk to us
          </Button>
        </div>
      </Container>
    </section>
  );
}
