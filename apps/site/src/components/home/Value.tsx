// What the owner gets, near the top of the home page: three numbers under the moving names, the places a customer
// searches (each one checked), and why it's safe to let it run.
import type { ReactNode } from "react";
import { Eye, Lock, Star, Undo2 } from "lucide-react";
import { revealDelay } from "../../lib/motion";
import { numbers } from "../../data/site";
import { cn } from "../ui";

export function Numbers() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {numbers.map((n, i) => (
        <div
          key={n.label}
          data-reveal
          style={revealDelay(i * 80)}
          className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface px-7 pt-7 pb-[26px]"
        >
          <span className="num font-display text-[48px] leading-none font-[650] tracking-[-0.04em] sm:text-[60px]">
            {n.value}
            {n.unit && <span className="ml-1.5 text-[24px] tracking-[-0.02em]">{n.unit}</span>}
          </span>
          <span className="max-w-[26ch] text-[16px] text-muted">{n.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A card with its icon beside the heading, the sentence under both. Lifts 2px under a mouse. */
function IconCard({
  icon,
  title,
  body,
  i,
  round = false,
  className,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  i: number;
  round?: boolean;
  className?: string;
}) {
  return (
    <div
      data-reveal
      style={revealDelay((i % 3) * 80)}
      className={cn(
        "grid grid-cols-[auto_1fr] items-center gap-x-3.5 gap-y-3 rounded-[14px] border border-line bg-surface p-6 transition-[transform,box-shadow] duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-card",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center",
          round ? "size-9 rounded-full bg-accent-soft text-accent-ink" : "size-10 rounded-[10px] bg-sunken",
        )}
      >
        {icon}
      </span>
      <h3 className="text-[18px] font-semibold">{title}</h3>
      <p className="col-span-2 text-[15.5px] leading-[1.6] text-muted">{body}</p>
    </div>
  );
}

const img = (src: string, ink = false) => (
  <img src={src} alt="" width={22} height={22} className={cn("size-[22px] object-contain", ink && "dark:invert")} />
);

const sources = [
  {
    icon: img("/icons/google-maps.svg"),
    title: "Google Maps",
    body: "Your rank from every street around your door, not just from your own front desk.",
  },
  { icon: img("/icons/google-icon.svg"), title: "Google search", body: "Where you show up for the searches that bring paying customers." },
  {
    icon: img("/icons/openai.svg", true),
    title: "ChatGPT",
    body: "Whether it recommends you when someone asks for a business like yours.",
  },
  { icon: img("/icons/gemini.svg"), title: "AI Overviews", body: "The answer box at the top of Google, and whether you're named in it." },
  { icon: img("/icons/perplexity.svg"), title: "Perplexity", body: "What it says about you, and which sites it reads to decide." },
  {
    icon: <Star size={21} className="fill-[#f7b500] text-[#f7b500]" />,
    title: "Your competitors",
    body: "Who's ahead of you, and the reviews, photos and categories that put them there.",
  },
];

export function Sources() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sources.map((s, i) => (
        <IconCard key={s.title} i={i} {...s} />
      ))}
    </div>
  );
}

const trust = [
  {
    icon: <Eye size={19} />,
    title: "You see it before Google does",
    body: "Every suggestion waits for you, with the reason it matters.",
  },
  {
    icon: <Undo2 size={19} />,
    title: "Undo on every change",
    body: "Changed your mind? Put it back in one click.",
  },
  {
    icon: <Lock size={19} />,
    title: "Autopilot only where you say",
    body: "Off until you turn it on, one kind of change at a time.",
  },
];

export function Trust() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {trust.map((t, i) => (
        <IconCard key={t.title} i={i} round className="p-[26px]" {...t} />
      ))}
    </div>
  );
}
