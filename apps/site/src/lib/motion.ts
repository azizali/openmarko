// Motion helpers for the marketing pages: run something once when it scrolls into view, and count a number up.
// Both respect reduced motion: the element counts as seen at once and the number shows its final value.
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True from the first time the element is half in view; stays true. */
export function useSeenOnce<T extends Element>(threshold = 0.5) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(reducedMotion);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

/** Counts from 0 to `to` once `run` turns true: 1.2 s, strong ease-out, so it settles rather than stops. */
export function useCountUp(to: number, run: boolean, ms = 1200) {
  const [value, setValue] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (!run) return;
    if (reducedMotion()) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 4))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, run, ms]);
  return value;
}

/**
 * Scroll reveal for a page: every `[data-reveal]` below `root` fades up the first time it comes into view, after its
 * own `--reveal-delay`. Hidden only while this runs (the `reveal-on` class), so without JS or under reduced motion
 * everything simply shows.
 */
export function useReveal() {
  useLayoutEffect(() => {
    if (reducedMotion()) return;
    const html = document.documentElement;
    html.classList.add("reveal-on");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.shown = "";
          io.unobserve(e.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of document.querySelectorAll("[data-reveal]")) io.observe(el);
    return () => {
      io.disconnect();
      html.classList.remove("reveal-on");
    };
  }, []);
}

/** Style for a `[data-reveal]` element that should wait `ms` after its neighbours. */
export const revealDelay = (ms: number) => ({ ["--reveal-delay" as string]: `${ms}ms` });
