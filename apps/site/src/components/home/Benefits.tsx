// The home page's middle: where the visitor's customers search, what an agency report leaves out, four benefits each
// with a piece of the product, the three steps to a first check, and what owners say.
import { useEffect, useState, type ReactNode } from "react";
import { reducedMotion, revealDelay, useSeenOnce } from "../../lib/motion";
import { Check, Quote } from "lucide-react";
import { cn } from "../ui";
import { GridThumb } from "./MapGrid";
import { competitors, engines, gridRanks, top3 } from "./mock";
import { testimonials } from "../../data/site";

/** The places the product checks, with their real marks. */
export const channels = [
  { name: "Google Maps", icon: "/icons/google-maps.svg" },
  { name: "Google search", icon: "/icons/google-icon.svg" },
  { name: "ChatGPT", icon: "/icons/openai.svg", ink: true },
  { name: "AI Overviews", icon: "/icons/gemini.svg" },
  { name: "Perplexity", icon: "/icons/perplexity.svg" },
];

export function ChannelRow({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center justify-center gap-x-7 gap-y-3", className)}>
      {channels.map((c, i) => (
        <li key={c.name} data-reveal style={revealDelay(60 + i * 60)} className="inline-flex items-center gap-2 text-[14.5px] text-fg/80">
          <img src={c.icon} alt="" width={20} height={20} className={cn("size-5 object-contain", c.ink && "dark:invert")} />
          {c.name}
        </li>
      ))}
    </ul>
  );
}

const agency = [
  "A PDF of impressions once a month",
  "“You rank #1”, checked from their own office",
  "Changes made to your profile you never see",
];
const ours = [
  "Your position from 49 spots around your door, every week",
  "What ChatGPT, Perplexity and AI Overviews say when asked about you",
  "Each fix shown before it's sent, and an Undo after",
];

export function Problem() {
  const [ref, seen] = useSeenOnce<HTMLDivElement>();
  return (
    <div ref={ref} className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col gap-4">
        <p className="text-[15px] font-medium text-muted">What a monthly report gives you</p>
        <ul className="flex flex-col gap-4 font-display text-[26px] leading-[1.1] sm:text-[32px]">
          {agency.map((a, i) => (
            <li key={a}>
              <span className="strike thick" data-on={seen || undefined} style={{ ["--strike-delay" as string]: `${i * 260}ms` }}>
                {a}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-[15px] font-medium">What OpenMarko shows you</p>
        <ul className="flex flex-col gap-4">
          {ours.map((o) => (
            <li key={o} className="flex gap-3 border-t border-line pt-4 text-[18px] leading-snug">
              <Check size={20} className="mt-0.5 shrink-0 text-good" />
              {o}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A benefit with its piece of the product. Reveals with the right-hand column a beat late; lifts 2px under a mouse. */
function Card({ i, title, body, children }: { i: number; title: string; body: string; children: ReactNode }) {
  return (
    <div data-reveal style={revealDelay((i % 2) * 100)} className="flex">
      <div className="flex flex-1 flex-col gap-5 rounded-2xl border border-line bg-surface p-5 transition-[transform,box-shadow] duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-float sm:p-7">
        <h3 className="text-[16px] leading-[1.55] font-normal text-muted">
          <span className="font-medium text-fg">{title}.</span> {body}
        </h3>
        <div className="grid-fine flex min-h-[200px] flex-1 items-center justify-center rounded-xl border border-line bg-sunken p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function EveryStreet() {
  const ranks = gridRanks(5, 2);
  return (
    <div className="flex items-center gap-5">
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-3">
        <span className="text-[12px] text-muted">From the office</span>
        <span className="num font-display text-[34px] leading-none text-good">#1</span>
      </div>
      <span className="text-[13px] text-muted">vs</span>
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-3">
        <GridThumb size={5} ranks={ranks} px={76} />
        <span className="num text-[12px] text-muted">Top 3 in {top3(ranks)} of 25 spots</span>
      </div>
    </div>
  );
}

const answerWords = "Many patients recommend Bright Smile Dental for same-day visits, and its reviews mention short waits.".split(" ");
const named = new Set(["Bright", "Smile", "Dental"]);

/** The assistant's answer streams in word by word once in view, the way it does in ChatGPT; hovering plays it again. */
function AiAnswer() {
  const [ref, seen] = useSeenOnce<HTMLDivElement>(0.6);
  const [shown, setShown] = useState(() => (reducedMotion() ? answerWords.length : 0));
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!seen || reducedMotion()) return;
    setShown(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= answerWords.length) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
  }, [seen, run]);
  const streaming = shown < answerWords.length;
  return (
    <div ref={ref} onMouseEnter={() => !streaming && setRun((r) => r + 1)} className="flex w-full max-w-[330px] flex-col gap-2 text-[13px]">
      <div className="ml-auto rounded-xl rounded-br-sm bg-ink px-3 py-2 text-on-ink">Best emergency dentist near South Congress?</div>
      <div className="min-h-[62px] rounded-xl rounded-bl-sm border border-line bg-surface px-3 py-2 leading-relaxed">
        <img src={engines[0].icon} alt="" width={14} height={14} className="mr-1.5 inline size-3.5 align-[-2px] dark:invert" />
        <span className="sr-only">{answerWords.join(" ")}</span>
        <span aria-hidden className={cn(streaming && "stream-caret")}>
          {answerWords.slice(0, shown).map((w, i) => (
            <span key={i} className={cn(named.has(w) && "bg-accent-soft text-fg")}>
              {w}
              {i < shown - 1 && " "}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function WhyAhead() {
  const you = { reviews: 240, photos: 31, categories: 2 };
  const them = competitors[0]!;
  const rows = [
    { k: "Reviews", you: you.reviews, them: them.reviews },
    { k: "Photos", you: you.photos, them: 86 },
    { k: "Categories", you: you.categories, them: 4 },
  ];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-[12.5px]">
      <div className="flex justify-between text-muted">
        <span>You</span>
        <span>{them.name}</span>
      </div>
      {rows.map((r) => {
        const max = Math.max(r.you, r.them);
        return (
          <div key={r.k} className="flex flex-col gap-1">
            <span className="text-muted">{r.k}</span>
            <div className="flex items-center gap-2">
              <span className="num w-8 text-right">{r.you}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.you / max) * 100}%` }} />
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                <span className="block h-full rounded-full bg-ink/70" style={{ width: `${(r.them / max) * 100}%` }} />
              </span>
              <span className="num w-8">{r.them}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A suggestion that applies itself, shows Undo, and goes back: a 3.6 s loop that starts again on hover. */
function ApplyLoop() {
  return (
    <div className="apply-loop flex w-full max-w-[330px] flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <span className="text-[12px] font-medium text-accent">Change your Google profile</span>
      <p className="text-[13.5px] leading-snug">Say “Invisalign” and “emergency visits” in your description.</p>
      <p className="text-[12px] text-muted">Three keywords you track aren't in it yet.</p>
      <div className="relative mt-1 h-9">
        <span className="apply-a absolute inset-y-0 left-0 inline-flex items-center rounded-lg bg-ink px-3 text-[13px] font-medium text-on-ink">
          Apply to Google
        </span>
        <span className="apply-b absolute inset-y-0 left-0 inline-flex items-center gap-1.5 rounded-lg bg-good-soft px-3 text-[13px] font-medium text-good">
          <Check size={14} /> Sent to Google <span className="text-muted">· Undo</span>
        </span>
      </div>
    </div>
  );
}

export function BenefitGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card
        i={0}
        title="Every street"
        body="Google ranks you differently three blocks away. See where customers find you, and where they find someone else."
      >
        <EveryStreet />
      </Card>
      <Card
        i={1}
        title="AI answers"
        body="Whether ChatGPT, Perplexity and AI Overviews name you, what they say, and which sites they read."
      >
        <AiAnswer />
      </Card>
      <Card i={2} title="Why they're ahead" body="Their Google profile next to yours, so you know what to close first.">
        <WhyAhead />
      </Card>
      <Card
        i={3}
        title="One-click fixes"
        body="A short list each week, each with its reason. Apply one, undo it, or hand a kind to Autopilot."
      >
        <ApplyLoop />
      </Card>
    </div>
  );
}

const steps = [
  {
    title: "Find your business",
    body: "Search for it on Google from inside the app. We read your profile: categories, services, the cities you serve.",
  },
  {
    title: "Pick what to track",
    body: "We suggest Maps keywords, search terms and questions for the AI assistants from your profile and your area. Keep, drop or add.",
  },
  {
    title: "See your first map",
    body: "The first check starts at once. Your grid, your keywords and this week's fixes are there within minutes.",
  },
];

export function Steps() {
  return (
    <ol className="grid gap-8 lg:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} data-reveal style={revealDelay(i * 140)} className="relative flex flex-col gap-3 pt-5">
          <span aria-hidden className="draw-line absolute inset-x-0 top-0 h-px bg-fg/20" />
          <span className="font-display text-[44px] leading-none text-accent">{i + 1}</span>
          <h3 className="text-[19px] font-medium">{s.title}</h3>
          <p className="text-[15.5px] leading-[1.6] text-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * What owners say. A quote marked `sample` is the layout's stand-in: it shows on the dev server with a Sample tag and
 * never in a production build. Without a real quote the section is left out (`hasProof`).
 */
const shown = testimonials.filter((t) => !t.sample || import.meta.env.DEV);
export const hasProof = shown.length > 0;

export function Testimonials() {
  return (
    <ul className="grid gap-5 lg:grid-cols-3">
      {shown.map((t, i) => (
        <li
          key={t.name}
          data-reveal
          style={revealDelay(i * 100)}
          className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 sm:p-7"
        >
          <div className="flex items-center justify-between">
            <Quote size={22} className="text-accent" />
            {t.sample && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11.5px] font-medium text-warn">Sample, dev only</span>
            )}
          </div>
          <blockquote className="text-[17px] leading-[1.55] text-pretty">{t.quote}</blockquote>
          {t.result && <p className="rounded-lg bg-good-soft px-3 py-2 text-[13.5px] font-medium text-good">{t.result}</p>}
          <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
            <span className="grid size-10 place-items-center rounded-full bg-accent-soft font-medium text-accent">{t.name[0]}</span>
            <div>
              <div className="text-[14.5px] font-medium">{t.name}</div>
              <div className="text-[13px] text-muted">
                {t.role}, {t.business}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
