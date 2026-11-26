// The panel beside sign-in and sign-up, on wide screens: the promise people came from the marketing site for, three
// facts about the product, where it checks, and what owners say. Shown only with the SEO module (it describes it).
// The quote is the layout's stand-in while `sample` is true: the dev server shows it with a tag, a build never does.
import type { CSSProperties } from "react";
import { Undo2 } from "lucide-react";

const numbers = [
  { value: "10", unit: "min", label: "to your first check" },
  { value: "81", unit: "", label: "spots checked around your door" },
  { value: "1", unit: "click", label: "to apply a fix" },
];

const checks = [
  { name: "Google Maps", icon: "/icons/google-maps.svg", mono: false },
  { name: "Google search", icon: "/icons/google-icon.svg", mono: false },
  { name: "ChatGPT", icon: "/icons/openai.svg", mono: true },
  { name: "AI Overviews", icon: "/icons/gemini.svg", mono: false },
  { name: "Perplexity", icon: "/icons/perplexity.svg", mono: false },
];

/** Replace with a real owner's words, used with their permission, then set `sample` to false. */
const quote = {
  sample: true,
  text: "Our agency said we were number one. The map showed we vanished four blocks north. We fixed our categories that week.",
  who: "Owner, a dental practice",
  result: "Top 3 in 21 of 49 spots, up from 9",
};
const showQuote = !quote.sample || import.meta.env.DEV;

/** [left %, width px, rise seconds, start offset seconds] for the pins drifting up behind the words. */
const pins = [
  [6, 20, 30, -6],
  [18, 12, 38, -22],
  [34, 26, 34, -14],
  [52, 11, 44, -33],
  [66, 16, 36, -9],
  [80, 26, 30, -19],
  [91, 13, 40, -28],
] as const;

export function AuthAside() {
  return (
    <aside className="auth-band relative isolate hidden overflow-hidden rounded-[28px] text-white lg:flex lg:flex-col dark:ring-1 dark:ring-white/10">
      <div aria-hidden className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_top,transparent_38%,black_62%)]">
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
                "--o": w > 18 ? 0.9 : 0.45,
                "--s": `${5 + (w % 5)}s`,
              } as CSSProperties
            }
          >
            <span>
              <svg viewBox="0 0 40 56">
                <polygon points="20,0 4,18 20,22" fill="#ffe4f3" />
                <polygon points="20,0 36,18 20,22" fill="#f9b6dc" />
                <polygon points="4,18 20,22 20,56" fill="#fe7bcd" />
                <polygon points="36,18 20,22 20,56" fill="#c2367f" />
              </svg>
            </span>
          </div>
        ))}
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-between gap-10 p-10 xl:p-14">
        <div className="flex flex-col gap-4">
          <h2 className="max-w-[16ch] font-display text-[40px] leading-[1.02] font-semibold tracking-[-0.035em] xl:text-[48px]">
            More customers from Google. <span className="text-[#fe7bcd]">No agency needed.</span>
          </h2>
          <p className="max-w-[44ch] text-[16px] leading-[1.6] text-white/65">
            See where people nearby find you on Google Maps, Google search and ChatGPT, and fix what stops them.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {showQuote && (
            <figure className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              {quote.sample && (
                <span className="w-fit rounded-full bg-[#fbbf24]/15 px-2 py-0.5 text-[11.5px] font-medium text-[#fbbf24]">
                  Sample, dev only
                </span>
              )}
              <blockquote className="text-[16.5px] leading-[1.55] text-white/90">“{quote.text}”</blockquote>
              <figcaption className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                <span className="text-white/60">{quote.who}</span>
                <span className="font-medium text-[#4ade80]">{quote.result}</span>
              </figcaption>
            </figure>
          )}

          <dl className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {numbers.map((n) => (
              <div key={n.label} className="flex flex-col gap-1">
                <dt className="sr-only">{n.label}</dt>
                <dd className="font-display text-[32px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                  {n.value}
                  {n.unit && <span className="ml-1 text-[16px] tracking-[-0.02em]">{n.unit}</span>}
                </dd>
                <dd aria-hidden className="text-[13px] text-white/55">
                  {n.label}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-3">
            <span className="text-[13px] text-white/55">Checked where your customers search</span>
            <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
              {checks.map((c) => (
                <li key={c.name} className="inline-flex items-center gap-2 text-[14px] text-white/80">
                  <img src={c.icon} alt="" width={18} height={18} className={c.mono ? "size-[18px] invert" : "size-[18px]"} />
                  {c.name}
                </li>
              ))}
            </ul>
          </div>

          <p className="flex items-center gap-2 text-[13.5px] text-white/60">
            <Undo2 size={15} className="text-[#fe7bcd]" />
            Every change is shown first, and each one has an Undo.
          </p>
        </div>
      </div>
    </aside>
  );
}

/** On a phone the panel doesn't fit: the facts and where it checks, under the form instead. */
export function AuthProofCompact() {
  return (
    <div className="mt-10 flex flex-col gap-5 border-t border-line pt-8 lg:hidden">
      <dl className="grid grid-cols-3 gap-3">
        {numbers.map((n) => (
          <div key={n.label} className="flex flex-col gap-1">
            <dt className="sr-only">{n.label}</dt>
            <dd className="font-display text-[24px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
              {n.value}
              {n.unit && <span className="ml-0.5 text-[13px] tracking-[-0.01em]">{n.unit}</span>}
            </dd>
            <dd aria-hidden className="text-[12px] leading-snug text-muted">
              {n.label}
            </dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Checked where your customers search">
        {checks.map((c) => (
          <li key={c.name} className="inline-flex items-center gap-1.5 text-[13px] text-muted">
            <img src={c.icon} alt="" width={16} height={16} className={c.mono ? "size-4 dark:invert" : "size-4"} />
            {c.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
