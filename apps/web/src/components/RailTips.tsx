// Names for the icons in the narrow sidebar. A browser `title` shows after a second, looks out of place, and never shows
// for the keyboard; these show beside the rail after a short pause on hover, at once on keyboard focus, and at once while
// you run the pointer down the rail, so scanning it reads like a menu.
//
// One tooltip serves the whole rail: a row says what it is with `data-tip` (its name), and optionally `data-tip-group`
// (the group it sits in, whose label the rail hides) and `data-tip-key` (its shortcut). The tooltip goes to the body, so
// the rail's scrolling list doesn't clip it.
import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

/** The props that give a rail row its tooltip. */
export const railTip = (name: string, more?: { group?: string; shortcut?: string }) => ({
  "data-tip": name,
  ...(more?.group ? { "data-tip-group": more.group } : {}),
  ...(more?.shortcut ? { "data-tip-key": more.shortcut } : {}),
});

type Tip = { el: Element; name: string; group?: string; shortcut?: string; top: number; left: number };

/** How long the pointer rests on a row before its name shows, and how long after one hides the next shows at once. */
const delay = 300;
const warmFor = 400;

export function RailTips({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const warmUntil = useRef(0);
  const waiting = useRef<Element | null>(null);
  // A row you just clicked keeps quiet until the pointer leaves it: what it opened is showing.
  const quiet = useRef<Element | null>(null);

  const rowAt = (target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest("[data-tip]") : null;
    return el && root.current?.contains(el) ? el : null;
  };
  const show = (el: Element) => {
    const row = el.getBoundingClientRect();
    const rail = root.current!.getBoundingClientRect();
    setTip({
      el,
      name: el.getAttribute("data-tip") ?? "",
      group: el.getAttribute("data-tip-group") ?? undefined,
      shortcut: el.getAttribute("data-tip-key") ?? undefined,
      top: row.top + row.height / 2,
      left: rail.right + 6,
    });
  };
  const hide = () => {
    clearTimeout(timer.current);
    waiting.current = null;
    setTip((t) => {
      if (t) warmUntil.current = Date.now() + warmFor;
      return null;
    });
  };
  const hover = (el: Element | null) => {
    if (el !== quiet.current) quiet.current = null;
    if (!el || el === quiet.current) return hide();
    if (el === tip?.el || el === waiting.current) return; // moving over the row's own icon or text
    clearTimeout(timer.current);
    waiting.current = null;
    if (tip || Date.now() < warmUntil.current) return show(el);
    waiting.current = el;
    timer.current = setTimeout(() => {
      waiting.current = null;
      show(el);
    }, delay);
  };

  return (
    <div
      ref={root}
      className={className}
      onPointerOver={(e) => e.pointerType === "mouse" && hover(rowAt(e.target))}
      onPointerLeave={() => {
        quiet.current = null;
        hide();
      }}
      onPointerDown={(e) => {
        quiet.current = rowAt(e.target);
        hide();
      }}
      onFocus={(e) => {
        const el = rowAt(e.target);
        if (el && el.matches(":focus-visible")) show(el);
      }}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") hide();
      }}
      onScrollCapture={hide}
    >
      {children}
      {tip &&
        createPortal(
          // Placed by the outer box, animated by the inner one, so the two transforms don't fight.
          <div aria-hidden className="pointer-events-none fixed z-50 -translate-y-1/2" style={{ top: tip.top, left: tip.left }}>
            <div className="anim-tip flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-[12.5px] font-medium whitespace-nowrap text-on-ink shadow-float">
              {tip.group && (
                <>
                  <span className="opacity-60">{tip.group}</span>
                  <ChevronRight size={11} className="opacity-50" />
                </>
              )}
              <span>{tip.name}</span>
              {tip.shortcut && <kbd className="ml-1.5 font-sans text-[11px] opacity-60">{tip.shortcut}</kbd>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
