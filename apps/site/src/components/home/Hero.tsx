// The home page's first screen: the promise, the website field with Try it free, and the app window right under it,
// so the product shows on the first screen and runs past it. Paper pins rise slowly behind the words (Lanterns).
// The words enter once on load, a beat apart; the window comes last.
import type { CSSProperties } from "react";
import { Container } from "../ui";
import { Lanterns } from "../Lanterns";
import { TryPoints, TrySite } from "../TrySite";
import { hero } from "../../data/site";
import { AppShowcase } from "./AppShowcase";

const enter = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

export function Hero() {
  return (
    <div id="try" className="hero-sky relative isolate scroll-mt-16">
      <Lanterns className="h-[640px]" />
      <Container className="relative z-10 flex flex-col items-center gap-4 pt-10 pb-9 text-center">
        <h1
          className="enter max-w-[21ch] font-display text-[38px] leading-none font-medium tracking-[-0.04em] sm:text-[56px] lg:text-[66px]"
          style={enter(0)}
        >
          {hero.title} <span className="text-accent-ink">{hero.accent}</span>
        </h1>
        <p className="enter max-w-[52ch] text-[17.5px] leading-[1.55] text-fg/70 text-pretty" style={enter(60)}>
          {hero.sub}
        </p>
        <TrySite className="enter mt-1" />
        <TryPoints alt className="enter" />
      </Container>
      <Container className="relative z-10 pb-16">
        <div id="app" className="enter mx-auto max-w-[1120px] scroll-mt-20" style={enter(260)}>
          <AppShowcase />
        </div>
      </Container>
      {/* The window settles into the page: the sky fades to the page ground under it. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
