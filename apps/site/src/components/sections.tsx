import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "../lib/motion";
import { Plus } from "lucide-react";
import { Button, CheckList, Container, cn } from "./ui";
import { APP_NAME, APP_URL, CONTACT_EMAIL, faqs as defaultFaqs, features, plans, steps } from "../data/site";
import { Lanterns } from "./Lanterns";
import { TryPoints, TrySite } from "./TrySite";

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
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((f, i) => (
        <li key={f.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] font-medium"
          >
            {f.q}
            <Plus
              size={20}
              className={cn("shrink-0 text-muted transition-transform duration-300 ease-[var(--ease-out)]", open === i && "rotate-45")}
            />
          </button>
          {/* The answer opens to its own height (grid rows 0fr → 1fr) and stays out of the tab order while closed. */}
          <div
            inert={open !== i}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-out)]",
              open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <p className="max-w-[60ch] pb-6 text-[16px] leading-[1.6] text-muted">{f.a}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function useWidenOnScroll() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 as its top enters the bottom of the screen, 1 once the whole band is in view.
      const t = 1 - Math.min(1, Math.max(0, (vh - r.top) / Math.min(r.height, vh)));
      el.style.setProperty(
        "clip-path",
        t ? `inset(0px max(${16 * t}px, calc(${t} * (100% - 1200px) / 2)) round ${24 * t}px ${24 * t}px 0px 0px)` : "none",
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return ref;
}

/**
 * The closing band on every page: the promise again, the website field and paper pins rising. As it scrolls into view
 * it opens from a rounded card inset from the page's edges to the full width, meeting the footer below it (off under
 * reduced motion).
 */
export function FinalCta() {
  const ref = useWidenOnScroll();
  return (
    <section ref={ref} className="relative isolate overflow-hidden bg-band text-white">
      <div aria-hidden className="grid-band absolute inset-0" />
      <Lanterns className="h-full" />
      <Container className="relative z-10 flex flex-col items-center gap-5 pt-24 pb-20 text-center sm:pt-28">
        <h2 className="max-w-[18ch] font-display text-[34px] leading-[1.02] font-[650] tracking-[-0.035em] sm:text-[48px] lg:text-[56px]">
          Let {APP_NAME} bring your next customer. <span className="text-[#fe7bcd]">It takes 10 minutes to start.</span>
        </h2>
        <TrySite band className="mt-1" />
        <TryPoints band />
      </Container>
    </section>
  );
}
