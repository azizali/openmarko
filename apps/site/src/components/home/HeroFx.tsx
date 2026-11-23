// Pointer and scroll effects for the hero. All are off under reduced motion, and the pointer ones without a mouse
// (touch fires false hovers).
//   StreetLight    a street map shows only in a soft light around the pointer, with a "you are here" pin following it
//   useScrollTilt  the app tile starts tilted back and lies flat as you scroll
//   useDepth       the cards around the tile drift against the pointer, each by its own depth
// The tile's own effect (moving onto its map runs the check again) is in RankTile.
import { useEffect, useRef, type RefObject } from "react";
import { reducedMotion } from "../../lib/motion";

const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const pointerFx = () => !reducedMotion() && finePointer();

/** A wide drawn street map, the same look as the one in the tile. */
function StreetMap() {
  const roads = [
    ["M-20 120 C 300 90, 700 150, 1460 100", 9],
    ["M-20 300 L 1460 270", 11],
    ["M-20 470 C 400 500, 900 430, 1460 480", 8],
    ["M-20 640 L 1460 620", 6],
    ["M180 -20 L 150 800", 6],
    ["M420 -20 L 445 800", 10],
    ["M720 -20 L 700 800", 12],
    ["M1010 -20 L 1040 800", 9],
    ["M1270 -20 L 1250 800", 6],
    ["M-20 200 L 1460 190 M-20 390 L 1460 372 M-20 560 L 1460 548", 3],
    ["M300 -20 L 290 800 M570 -20 L 585 800 M860 -20 L 850 800 M1150 -20 L 1160 800", 3],
  ] as const;
  return (
    <svg viewBox="0 0 1440 780" preserveAspectRatio="xMidYMin slice" className="absolute inset-0 size-full" aria-hidden>
      <rect width="1440" height="780" fill="var(--map-land)" />
      <path
        d="M-20 20 C 250 -10, 500 60, 820 30 S 1250 -5, 1460 25 L 1460 70 C 1200 50, 1000 85, 800 78 S 300 45, -20 70 Z"
        fill="var(--map-water)"
      />
      <path d="M470 320 h210 v130 h-210z M1060 500 h170 v100 h-170z M190 500 h220 v110 h-220z" fill="var(--map-park)" />
      <g stroke="var(--map-road)" strokeLinecap="round" fill="none">
        {roads.map(([d, sw]) => (
          <path key={d} d={d} strokeWidth={sw} />
        ))}
      </g>
    </svg>
  );
}

/** The street map, lit only around the pointer, with a pin that follows it a beat behind. */
export function StreetLight({ host }: { host: RefObject<HTMLElement | null> }) {
  const light = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    const lit = light.current;
    const p = pin.current;
    if (!el || !lit || !p || !pointerFx()) return;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    const tick = () => {
      // The light sits on the pointer; the pin eases after it, so it reads as placed rather than glued.
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      p.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = Math.hypot(tx - x, ty - y) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      tx = e.clientX - b.left;
      ty = e.clientY - b.top;
      if (lit.dataset.on !== "") {
        x = tx;
        y = ty;
        lit.dataset.on = "";
        p.dataset.on = "";
      }
      lit.style.setProperty("--px", `${tx}px`);
      lit.style.setProperty("--py", `${ty}px`);
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const leave = () => {
      delete lit.dataset.on;
      delete p.dataset.on;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [host]);
  return (
    <>
      <div
        ref={light}
        aria-hidden
        className="street-light pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 data-[on]:opacity-100"
      >
        <StreetMap />
      </div>
      {/* Above the words, so it never hides behind the headline. */}
      <div
        ref={pin}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 z-20 opacity-0 transition-opacity duration-300 data-[on]:opacity-100"
      >
        <span className="radar absolute -top-2 -left-2 size-4 rounded-full bg-accent" />
        <span className="absolute -top-2 -left-2 size-4 rounded-full border-[3px] border-surface bg-accent shadow-float" />
      </div>
    </>
  );
}

/** Lays the tile flat over the first 480px of scroll: 8° back and 96.5% wide at the top of the page. */
export function useScrollTilt(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current;
    if (!el || reducedMotion()) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const p = Math.min(1, window.scrollY / 480);
      el.style.setProperty("transform", `perspective(1800px) rotateX(${8 * (1 - p)}deg) scale(${0.965 + 0.035 * p})`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    el.style.setProperty("transform-origin", "50% 0%");
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      el.style.removeProperty("transform");
    };
  }, [target]);
}

/** Moves every `[data-depth]` inside the host against the pointer, by up to its depth in px, easing after it. */
export function useDepth(host: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = host.current;
    if (!el || !pointerFx()) return;
    const layers = [...el.querySelectorAll<HTMLElement>("[data-depth]")];
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      for (const l of layers) {
        const d = Number(l.dataset.depth);
        l.style.transform = `translate3d(${-x * d}px, ${-y * d}px, 0)`;
      }
      frame = Math.hypot(tx - x, ty - y) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      tx = ((e.clientX - b.left) / b.width) * 2 - 1;
      ty = ((e.clientY - b.top) / b.height) * 2 - 1;
      kick();
    };
    const leave = () => {
      tx = ty = 0;
      kick();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      for (const l of layers) l.style.transform = "";
    };
  }, [host]);
}
