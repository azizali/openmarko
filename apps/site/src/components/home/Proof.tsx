// Social proof under the hero: how many businesses use it and their names drifting past. All of it comes from `proof`
// in data/site.ts; while that's marked `sample` it shows on the dev server only, with a Sample tag, and a production
// build leaves it out.
import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "../ui";
import { proof } from "../../data/site";
import { useCountUp, useSeenOnce } from "../../lib/motion";

export const showProof = !proof.sample || import.meta.env.DEV;

function SampleTag() {
  return proof.sample ? (
    <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11.5px] font-medium text-warn">Sample, dev only</span>
  ) : null;
}

/** Each name set like a small shop sign: a different face per business, so the strip reads as many brands. */
const faces = [
  "font-display text-[19px]",
  "font-serif text-[20px] italic",
  "font-sans text-[17px] font-semibold tracking-[-0.02em]",
  "font-mono text-[15px] uppercase tracking-wider",
  "font-serif text-[19px] font-medium",
];

export function ProofStrip() {
  const [paused, setPaused] = useState(false);
  const [ref, seen] = useSeenOnce<HTMLDivElement>(0.4);
  const count = useCountUp(proof.businesses, seen, 1400);
  const row = proof.names.map((n, i) => (
    <li key={n} className={cn("shrink-0 text-fg/55", faces[i % faces.length])}>
      {n}
    </li>
  ));
  return (
    <div ref={ref} className="flex flex-col items-center gap-5">
      <p className="flex flex-wrap items-center justify-center gap-2 text-center text-[14px] text-muted">
        <span>
          Used by <b className="num font-semibold text-fg">{count.toLocaleString("en-US")}</b> local businesses, {proof.line}
        </span>
        <SampleTag />
      </p>
      <div className="flex w-full items-center gap-3">
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <ul className="marquee flex w-max gap-14 pr-14" data-paused={paused || undefined} aria-label="Businesses using it">
            {row}
            {/* The same names again, so the loop has no seam; hidden from screen readers. */}
            {proof.names.map((n, i) => (
              <li key={`again-${n}`} aria-hidden className={cn("shrink-0 text-fg/55", faces[i % faces.length])}>
                {n}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Play the moving names" : "Pause the moving names"}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </div>
    </div>
  );
}
