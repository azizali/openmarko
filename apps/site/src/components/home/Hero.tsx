// The home page's first screen: the promise centred, then the app's Google Maps page as a tile with three cards
// around it (an AI answer that names you, a fix sent to Google, the competitor ahead). Every part enters once on
// load, a beat apart; the cards come last. On narrow screens the cards are left out and the tile stands alone.
// Behind it a street map lights up around the pointer; the tile lies flat as you scroll and the cards drift against
// the pointer (HeroFx.tsx); moving onto the tile's map runs its check again (RankTile).
import { useRef, type CSSProperties, type ReactNode } from "react";
import { Check, MapPin, Star } from "lucide-react";
import { Button, Container, cn } from "../ui";
import { APP_URL, hero } from "../../data/site";
import { RankTile } from "./RankTile";
import { competitors, engines } from "./mock";
import { StreetLight, useDepth, useScrollTilt } from "./HeroFx";

const enter = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function Words() {
  return (
    <div className="flex flex-col items-center gap-7 text-center">
      <span className="enter inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1.5 text-[13px] text-muted shadow-card">
        <span className="grid size-5 place-items-center rounded-full bg-accent-soft text-accent">
          <MapPin size={12} />
        </span>
        {hero.badge}
      </span>
      <h1 className="enter max-w-[16ch] font-display text-[44px] leading-[0.95] sm:text-[64px] lg:text-[78px]" style={enter(60)}>
        {hero.title} <span className="ink-sheen">{hero.accent}</span>
      </h1>
      <p className="enter max-w-[46ch] text-[18px] leading-[1.55] text-fg/70 text-pretty" style={enter(120)}>
        {hero.sub}
      </p>
      <div className="enter flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row" style={enter(180)}>
        <Button href={`${APP_URL}/sign-up`} size="lg" arrow>
          {hero.primary}
        </Button>
        <Button href="#app" size="lg" variant="secondary">
          {hero.secondary}
        </Button>
      </div>
      <ul className="enter flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] text-muted" style={enter(220)}>
        {hero.points.map((p) => (
          <li key={p} className="inline-flex items-center gap-1.5">
            <Check size={15} className="text-good" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A card beside the tile. The outer box is placed (and drifts against the pointer); the inner one enters. */
function Float({ className, delay, depth, children }: { className?: string; delay: number; depth: number; children: ReactNode }) {
  return (
    <div data-depth={depth} className={cn("absolute hidden lg:block", className)}>
      <div className="enter rounded-xl border border-line bg-surface p-3.5 text-left text-[13px] shadow-float" style={enter(delay)}>
        {children}
      </div>
    </div>
  );
}

export function Hero() {
  const rival = competitors[0]!;
  const host = useRef<HTMLDivElement>(null);
  const tile = useRef<HTMLDivElement>(null);
  useScrollTilt(tile);
  useDepth(host);
  return (
    <div ref={host} className="relative">
      <div aria-hidden className="grid-backdrop absolute inset-x-0 top-0 mx-auto h-[760px] max-w-[1200px]" />
      <StreetLight host={host} />
      <Container rails className="relative flex flex-col items-center gap-10 pt-14 pb-16 sm:pt-20 lg:pb-24">
        <Words />
        <div className="relative w-full max-w-[1080px] lg:px-20">
          <div ref={tile} className="motion-reduce:transform-none!">
            <div className="enter" style={enter(300)}>
              <RankTile />
            </div>
          </div>
          <Float delay={800} depth={10} className="top-40 -left-2 w-[270px]">
            <div className="flex items-center gap-2 font-medium">
              <img src={engines[0].icon} alt="" width={16} height={16} className="size-4 dark:invert" />
              ChatGPT
              <span className="ml-auto rounded-full bg-good-soft px-2 py-0.5 text-[11.5px] text-good">Named #2</span>
            </div>
            <p className="mt-1.5 leading-snug text-fg/75">“…patients often mention Bright Smile Dental for same-day visits.”</p>
          </Float>
          <Float delay={950} depth={14} className="top-[42%] -right-2 w-[250px]">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-good">
              <Check size={14} /> Sent to Google
            </div>
            <p className="mt-1 leading-snug">
              Added <b className="font-semibold">Cosmetic dentist</b> to your categories.
            </p>
            <p className="mt-1 text-[12px] text-muted">Undo any time</p>
          </Float>
          <Float delay={1100} depth={7} className="bottom-10 -left-6 w-[270px]">
            <div className="text-[12px] font-medium text-bad">Ahead of you</div>
            <p className="mt-1 font-medium">{rival.name}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-muted">
              <Star size={12} className="fill-warn text-warn" /> {rival.rating} · {rival.reviews} reviews · {rival.ahead} of 12 keywords
            </p>
          </Float>
        </div>
      </Container>
    </div>
  );
}
