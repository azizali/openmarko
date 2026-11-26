// Folded paper map pins drifting up like lanterns, behind the home hero and the closing band. Mostly at the sides, so
// the middle stays clear for the words and the website field. Styles and timing in index.css (.lantern).
import type { CSSProperties } from "react";
import { cn } from "./ui";

/** [left %, width px, rise seconds, start offset seconds]. Negative offsets put pins mid-flight on load. */
const pins = [
  [4, 22, 26, -4],
  [13, 14, 34, -20],
  [22, 28, 30, -11],
  [30, 12, 40, -31],
  [46, 10, 44, -38],
  [56, 11, 42, -16],
  [70, 16, 36, -7],
  [78, 28, 28, -17],
  [87, 14, 38, -26],
  [93, 24, 32, -2],
] as const;

export function Lanterns({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 overflow-hidden", className)}>
      {pins.map(([x, w, d, delay]) => (
        <div
          key={x}
          className="lantern"
          style={
            {
              "--x": `${x}%`,
              "--w": `${w}px`,
              "--d": `${d}s`,
              "--delay": `${delay}s`,
              "--o": w > 20 ? 0.95 : 0.5,
              "--s": `${5 + (w % 5)}s`,
            } as CSSProperties
          }
        >
          <span>
            <svg viewBox="0 0 40 56">
              <polygon points="20,0 4,18 20,22" fill="var(--pin-a)" />
              <polygon points="20,0 36,18 20,22" fill="var(--pin-b)" />
              <polygon points="4,18 20,22 20,56" fill="var(--pin-c)" />
              <polygon points="36,18 20,22 20,56" fill="var(--pin-d)" />
            </svg>
          </span>
        </div>
      ))}
    </div>
  );
}
