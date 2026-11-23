// A drawn street map with a grid of ranked spots on it: the picture the app's Google Maps page is built around.
// Each dot is the business's position when Google Maps is searched from that spot; the pin in the middle is the door.
import type { CSSProperties } from "react";
import { cn } from "../ui";
import { rankFill } from "./mock";

function Streets() {
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
      <rect width="400" height="400" fill="var(--map-land)" />
      <path
        d="M-10 70 C 80 40, 150 95, 230 70 S 360 30, 420 55 L 420 105 C 340 80, 280 120, 220 118 S 90 90, -10 120 Z"
        fill="var(--map-water)"
      />
      <path d="M40 250 h70 v80 h-70z M300 300 h70 v60 h-70z" fill="var(--map-park)" />
      <g stroke="var(--map-road)" strokeLinecap="round" fill="none">
        <path d="M200 -10 L 196 410" strokeWidth="10" />
        <path d="M-10 230 L 410 214" strokeWidth="8" />
        <path d="M-10 330 C 120 320, 260 350, 410 300" strokeWidth="6" />
        <path d="M110 120 L 90 410 M300 116 L 320 410 M-10 170 L 410 160" strokeWidth="5" />
        <path d="M150 120 L 140 410 M250 120 L 262 410 M-10 280 L 410 268 M-10 380 L 410 372" strokeWidth="3" />
        <path d="M40 120 L 30 410 M360 110 L 380 410" strokeWidth="3" />
      </g>
    </svg>
  );
}

export function MapGrid({
  size,
  ranks,
  className,
  numbers = true,
  animate = false,
  origin,
}: {
  size: number;
  ranks: (number | null)[];
  className?: string;
  numbers?: boolean;
  /** Dots appear one after another from the door outwards, once, as the hero enters. */
  animate?: boolean;
  /** With `animate`: the spot (index) the dots spread out from, at once, instead of the door after the hero enters. */
  origin?: number;
}) {
  const c = (size - 1) / 2;
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-xl", className)}>
      <Streets />
      <div
        className="absolute inset-[7%] grid"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}
      >
        {ranks.map((r, i) => {
          const row = Math.floor(i / size);
          const col = i % size;
          const door = row === c && col === c;
          const from =
            origin === undefined
              ? { row: c, col: c, wait: 300, step: 110 }
              : { row: Math.floor(origin / size), col: origin % size, wait: 0, step: 80 };
          const ring = Math.max(Math.abs(row - from.row), Math.abs(col - from.col));
          return (
            <div key={i} className="grid place-items-center">
              <span
                className={cn(
                  "num relative grid aspect-square w-[62%] place-items-center rounded-full text-[clamp(9px,1.2vw,13px)] font-semibold text-white shadow-[0_1px_3px_rgb(0_0_0/0.25)]",
                  animate && "dot-in",
                  door && "outline-2 outline-offset-2 outline-ink",
                )}
                style={
                  { background: rankFill(r), animationDelay: animate ? `${from.wait + ring * from.step}ms` : undefined } as CSSProperties
                }
              >
                {numbers ? (r ?? "–") : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GridLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted", className)}>
      {(
        [
          ["Top 3", "var(--good)"],
          ["4–10", "var(--warn)"],
          ["11–20", "var(--bad)"],
          ["Not found", "var(--subtle)"],
        ] as const
      ).map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

/** The small grid the app shows beside a keyword in a list. */
export function GridThumb({ size, ranks, px = 44 }: { size: number; ranks: (number | null)[]; px?: number }) {
  const cell = px / size;
  return (
    <svg width={px} height={px} className="shrink-0 rounded bg-sunken" aria-hidden>
      {ranks.map((r, i) => (
        <circle key={i} cx={(i % size) * cell + cell / 2} cy={Math.floor(i / size) * cell + cell / 2} r={cell * 0.32} fill={rankFill(r)} />
      ))}
    </svg>
  );
}
