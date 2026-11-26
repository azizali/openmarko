// The home page's middle: the three steps on one path, four benefits one per row each with a piece of the product,
// what owners say, and, low on the page, what an agency report leaves out.
import { useEffect, useState, type ReactNode } from "react";
import { reducedMotion, revealDelay, useSeenOnce } from "../../lib/motion";
import { Check, Quote } from "lucide-react";
import { cn } from "../ui";
import { GridThumb } from "./MapGrid";
import { competitors, engines, gridRanks, top3 } from "./mock";
import { testimonials } from "../../data/site";

const agency = [
  { them: "A PDF once a month", us: "Fresh numbers every week" },
  { them: "“You rank #1”, checked from their office", us: "Your rank from every street around your door" },
  { them: "AI answers not checked", us: "What ChatGPT, Perplexity and AI Overviews say about you" },
  { them: "Changes made without you seeing", us: "Every fix shown before it's sent, with an Undo" },
];

/** What an agency report gives you, struck through as it comes into view, beside what OpenMarko shows. Read across. */
export function Problem() {
  const [ref, seen] = useSeenOnce<HTMLDivElement>();
  return (
    <div ref={ref} className="mx-auto max-w-[880px]">
      <div className="hidden grid-cols-2 gap-6 pb-3.5 text-[13.5px] text-muted sm:grid">
        <span>A monthly agency report</span>
        <span className="font-medium text-fg">OpenMarko</span>
      </div>
      {agency.map((a, i) => (
        <div key={a.us} className="grid gap-2 border-t border-line py-5 sm:grid-cols-2 sm:gap-6">
          <span className="text-[17px] text-muted">
            <span className="strike" data-on={seen || undefined} style={{ ["--strike-delay" as string]: `${i * 220}ms` }}>
              {a.them}
            </span>
          </span>
          <span className="flex gap-2.5 text-[17px]">
            <Check size={18} className="mt-1 shrink-0 text-accent-ink" />
            {a.us}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A benefit with its piece of the product: words on one side, the picture on the other, alternating down the page. */
function Row({ i, title, body, children }: { i: number; title: string; body: string; children: ReactNode }) {
  return (
    <div data-reveal className="grid items-center gap-7 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
      <div className={cn("flex max-w-[420px] min-w-0 flex-col gap-3.5", i % 2 === 1 && "lg:order-2")}>
        <h3 className="font-display text-[26px] leading-[1.1] font-[650] tracking-[-0.025em] sm:text-[28px]">{title}</h3>
        <p className="text-[17px] leading-[1.6] text-muted">{body}</p>
      </div>
      <div className="dot-ground flex min-h-[300px] min-w-0 items-center justify-center rounded-[20px] bg-bg p-6 sm:p-8">{children}</div>
    </div>
  );
}

function EveryStreet() {
  const ranks = gridRanks(5, 2);
  return (
    <div className="flex items-center gap-5">
      <div className="flex flex-col items-center gap-1.5 rounded-[14px] border border-line bg-surface px-[18px] py-4">
        <span className="text-[12px] text-muted">From the office</span>
        <span className="num font-display text-[40px] leading-none text-good">#1</span>
      </div>
      <span className="text-[13px] text-muted">vs</span>
      <div className="flex flex-col items-center gap-1.5 rounded-[14px] border border-line bg-surface px-[18px] py-4">
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
      <div className="ml-auto rounded-[14px] rounded-br-[4px] bg-ink px-3 py-[9px] text-on-ink">
        Best emergency dentist near South Congress?
      </div>
      <div className="min-h-[62px] rounded-[14px] rounded-bl-[4px] border border-line bg-surface px-3 py-2.5 leading-relaxed">
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
    <div className="flex w-full max-w-[330px] flex-col gap-3.5 rounded-[14px] border border-line bg-surface p-[18px] text-[12.5px]">
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
    <div className="apply-loop flex w-full max-w-[340px] flex-col gap-2 rounded-[14px] border border-line bg-surface p-[18px]">
      <span className="text-[12px] font-medium text-accent">Change your Google profile</span>
      <p className="text-[13.5px] leading-snug">Say “Invisalign” and “emergency visits” in your description.</p>
      <p className="text-[12px] text-muted">Three keywords you track aren't in it yet.</p>
      <div className="relative mt-1 h-9">
        <span className="apply-a absolute inset-y-0 left-0 inline-flex items-center rounded-[10px] bg-ink px-3.5 text-[13px] font-medium text-on-ink">
          Apply to Google
        </span>
        <span className="apply-b absolute inset-y-0 left-0 inline-flex items-center gap-1.5 rounded-[10px] bg-good-soft px-3.5 text-[13px] font-medium text-good">
          <Check size={14} /> Sent to Google <span className="text-muted">· Undo</span>
        </span>
      </div>
    </div>
  );
}

export function FeatureRows() {
  return (
    <div className="flex flex-col gap-20 lg:gap-24">
      <Row
        i={0}
        title="See every street"
        body="Google ranks you differently three blocks away. See where nearby customers find you, and where they find someone else."
      >
        <EveryStreet />
      </Row>
      <Row
        i={1}
        title="Hear what AI says about you"
        body="Find out whether ChatGPT, Perplexity and AI Overviews recommend you, what they say, and which sites they read."
      >
        <AiAnswer />
      </Row>
      <Row
        i={2}
        title="Know why they're ahead"
        body="The business above you, next to yours: reviews, photos and categories. You see what to close first."
      >
        <WhyAhead />
      </Row>
      <Row
        i={3}
        title="Fix it in one click"
        body="A short list each week, each with its reason. Apply one, undo it, or let Autopilot handle a kind of fix for you."
      >
        <ApplyLoop />
      </Row>
    </div>
  );
}

/** Each step's small picture of that moment in the app. */
function StepPicture({ i }: { i: number }) {
  const box =
    "mt-3.5 flex w-full max-w-[300px] flex-col gap-2 rounded-[14px] border border-line bg-surface p-3.5 text-left text-[13px] shadow-card";
  if (i === 0)
    return (
      <div aria-hidden className={box}>
        <div className="flex items-center justify-between gap-2 rounded-full border border-line py-1.5 pr-1.5 pl-3">
          <span className="truncate font-medium">brightsmiledental.com</span>
          <span className="shrink-0 rounded-full bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-on-ink">Try it free</span>
        </div>
        <span className="flex items-center gap-2 text-muted">
          <img src="/icons/google-maps.svg" alt="" width={16} height={16} className="size-4" />
          Found: Bright Smile Dental, South Congress
        </span>
      </div>
    );
  if (i === 1)
    return (
      <div aria-hidden className={box}>
        <div className="flex flex-wrap gap-1.5">
          {["dentist", "emergency dentist", "invisalign", "Best dentist near me?"].map((k) => (
            <span key={k} className="rounded-full border border-accent/40 bg-accent-soft px-2.5 py-[5px]">
              {k}
            </span>
          ))}
          <span className="rounded-full border border-line px-2.5 py-[5px] text-muted">+ add your own</span>
        </div>
      </div>
    );
  return (
    <div aria-hidden className={box}>
      <span className="text-[12px] font-medium text-accent-ink">Change your Google profile</span>
      <span>Add “emergency visits” to your description.</span>
      <span className="w-fit rounded-lg bg-ink px-[11px] py-[7px] text-[12.5px] font-medium text-on-ink">Apply to Google</span>
    </div>
  );
}

const steps = [
  { title: "Enter your website", body: "We find your Google profile and read your services and the area you serve." },
  { title: "We check where you show up", body: "Google Maps from every street around you, Google search, and what AI assistants say." },
  { title: "You get more customers", body: "Apply this week's fixes in a click and watch your map turn green." },
];

/** Three stops on one dashed path; a dot runs from 1 to 3 (index.css, .step-path). Down the left on narrow screens. */
export function Steps() {
  return (
    <ol className="step-path relative grid gap-10 lg:grid-cols-3 lg:gap-8">
      <span aria-hidden className="step-runner" />
      {steps.map((s, i) => (
        <li
          key={s.title}
          className="relative grid grid-cols-[40px_1fr] items-start gap-x-4 lg:flex lg:flex-col lg:items-center lg:gap-2.5 lg:text-center"
        >
          <span
            className={cn(
              "num relative z-10 row-span-3 grid size-10 place-items-center rounded-full border-2 bg-sunken font-mono text-[15px] font-semibold",
              i === 2 ? "border-accent text-accent-ink" : "border-line-strong",
            )}
          >
            {i + 1}
          </span>
          <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.01em]">{s.title}</h3>
          <p className="max-w-[32ch] text-[16px] leading-[1.6] text-muted">{s.body}</p>
          <StepPicture i={i} />
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
