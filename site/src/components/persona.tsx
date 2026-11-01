import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Car, ChevronDown, Droplets, Fan, House, Pencil, Scale, Smile, Sparkles, Store, X as XIcon, Zap } from "lucide-react";
import { Container, cn } from "./ui";
import { emptyInput, resolvePersona, samplePersona, trades, type Persona, type PersonaInput, type TradeId } from "../data/persona";
import { cityFromIp } from "../data/geo";

// ---------- State: who the page is about ----------

type Ctx = { p: Persona; input: PersonaInput; setInput: (i: PersonaInput) => void; clear: () => void; picker: boolean; setPicker: (open: boolean) => void };
const PersonaCtx = createContext<Ctx>({ p: samplePersona, input: emptyInput, setInput: () => {}, clear: () => {}, picker: false, setPicker: () => {} });

/** Read the visitor's business. Outside the provider (other pages) it is always the sample. */
export const usePersona = () => useContext(PersonaCtx);

const KEY = "om-persona";
const ASKED = "om-trade-asked";

function load(): PersonaInput {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v.name === "string" && typeof v.city === "string" && trades.some((t) => t.id === v.trade)) return { name: v.name, city: v.city, trade: v.trade };
  } catch {}
  return emptyInput;
}

function asked() {
  try { return localStorage.getItem(ASKED) === "1"; } catch { return true; }
}

/**
 * Holds who the page is about. The city is guessed from the visitor's IP on first load; the trade comes from
 * the picker, which opens once per browser; the name only if they type it. Typed changes land a beat after
 * the visitor stops typing, not on every key.
 */
export function PersonaProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState<PersonaInput>(load);
  const [committed, setCommitted] = useState(input);
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setCommitted(input), 350);
    return () => clearTimeout(id);
  }, [input]);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(committed)); } catch {}
  }, [committed]);
  useEffect(() => {
    if (input.city) return;
    let live = true;
    cityFromIp().then((city) => { if (live && city) setInput((i) => (i.city ? i : { ...i, city })); });
    return () => { live = false; };
    // Only on first load: a visitor who clears the city later gets the example back, not the guess.
  }, []);
  useEffect(() => {
    if (asked()) return;
    const id = setTimeout(() => setPicker(true), 500);
    return () => clearTimeout(id);
  }, []);
  const value = useMemo(() => ({
    p: resolvePersona(committed), input, setInput, picker, setPicker,
    clear: () => { setInput(emptyInput); setCommitted(emptyInput); },
  }), [committed, input, picker]);
  return <PersonaCtx.Provider value={value}>{children}</PersonaCtx.Provider>;
}

/** A word that belongs to the visitor. When it changes, an accent underline draws in under it. */
export function Mine({ children, className }: { children: ReactNode; className?: string }) {
  const { p } = usePersona();
  if (p.isSample) return <>{children}</>;
  return <span key={String(children)} className={cn("mine", className)}>{children}</span>;
}

/** "one plumber in Austin", or the visitor's own business once they name it. */
export function followAlong(p: Persona) {
  return p.named ? `${p.name} in ${p.city}` : `one ${p.trade.noun} in ${p.city}`;
}

/** Moves focus into the banner form. */
export function focusCapture() {
  const el = document.getElementById("personalize");
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }), 450);
}

// ---------- The trade picker: once per browser, and on demand ----------

const tradeIcons: Record<TradeId, typeof Car> = { plumber: Droplets, hvac: Fan, roofer: House, electrician: Zap, dentist: Smile, medspa: Sparkles, lawfirm: Scale, autorepair: Car, other: Store };

export function TradePicker() {
  const { p, input, setInput, picker, setPicker } = usePersona();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (picker && !d.open) {
      d.showModal();
      // Land on the question, not the close button, so nothing looks pre-selected.
      d.querySelector<HTMLElement>("h2")?.focus();
    }
    if (!picker && d.open) d.close();
  }, [picker]);
  const done = () => {
    try { localStorage.setItem(ASKED, "1"); } catch {}
    setPicker(false);
  };
  const pick = (trade: TradeId) => { setInput({ ...input, trade }); done(); };
  return (
    <dialog
      ref={ref}
      onClose={done}
      onClick={(e) => e.target === e.currentTarget && done()}
      aria-labelledby="trade-picker-title"
      className="m-auto w-[calc(100%-32px)] max-w-[560px] rounded-2xl border border-line bg-surface p-0 text-fg shadow-float backdrop:bg-black/45"
    >
      {picker && (
        <div className="rise flex flex-col gap-5 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 id="trade-picker-title" tabIndex={-1} className="outline-none font-display text-[28px] leading-[1.02] sm:text-[32px]">What kind of business do you run?</h2>
              <p className="text-[15px] text-muted text-pretty">This page walks through Marko working for one business. Pick yours and it'll be one like it{p.located ? ` in ${p.city}` : ""}.</p>
            </div>
            <button type="button" onClick={done} aria-label="Close" className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><XIcon size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {trades.map((t) => {
              const Icon = tradeIcons[t.id];
              const on = t.id === input.trade && asked();
              return (
                <button key={t.id} type="button" onClick={() => pick(t.id)}
                  className={cn("flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[15px] font-medium transition-colors hover:border-accent/50 hover:bg-accent-soft/40 focus-visible:border-accent focus-visible:outline-none", on ? "border-accent bg-accent-soft/50" : "border-line")}>
                  <Icon size={18} className={t.id === "other" ? "text-muted" : "text-accent"} />{t.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={done} className="self-start text-[14px] text-muted underline underline-offset-2 hover:text-fg">Skip, show me the plumber</button>
        </div>
      )}
    </dialog>
  );
}

/** Above the hero mock: whose search this is, with a way out for anyone who isn't a plumber. */
export function FollowAlong() {
  const { p, setPicker } = usePersona();
  return (
    <p className="mx-auto mb-3 max-w-[480px] text-center text-[13.5px] text-muted">
      Follow along: <span className="font-medium text-fg">{p.named ? <Mine>{p.name}</Mine> : <>one {p.trade.noun}</>}</span> in <Mine>{p.city}</Mine>
      {!p.named && <>{" · "}<button type="button" onClick={() => setPicker(true)} className="underline underline-offset-2 hover:text-fg">{p.trade.id === "other" ? "Change" : `Not ${p.trade.one}?`}</button></>}
    </p>
  );
}

// ---------- The banner: name, city and trade, committed on submit ----------

export function BannerCapture() {
  const { p, input, setInput, clear } = usePersona();
  const [draft, setDraft] = useState(input);
  const [editing, setEditing] = useState(!p.named);
  // The IP city and the picker land after mount; fold them in without wiping what's being typed.
  useEffect(() => { setDraft((d) => ({ name: d.name || input.name, city: d.city || input.city, trade: input.trade })); }, [input]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setInput(draft);
    if (draft.name.trim()) setEditing(false);
  };
  const reset = () => { clear(); setDraft(emptyInput); setEditing(true); };
  const field = "h-11 min-w-0 rounded-lg border border-on-ink/20 bg-on-ink/10 px-3.5 text-[15px] text-on-ink outline-none placeholder:text-on-ink/60 focus:border-on-ink/60";
  return (
    <section id="personalize" className="bg-ink text-on-ink">
      <Container rails className="flex flex-col gap-5 py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <p className="font-display text-[26px] leading-[1.05] sm:text-[30px]">
          This page follows {p.named ? <Mine>{p.name}</Mine> : <>one {p.trade.noun}</>} in <Mine>{p.city}</Mine>.
          <br /><span className="text-on-ink/60">{p.named ? "Every section below is now about you." : "Make it about your business."}</span>
        </p>
        {editing ? (
          <form onSubmit={submit} className="grid w-full gap-2 sm:grid-cols-[1.3fr_1fr_1fr_auto] lg:max-w-[720px]">
            <input aria-label="Your business name" className={field} placeholder="Business name" autoComplete="organization" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input aria-label="Your city" className={field} placeholder="City" autoComplete="address-level2" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
            <span className="relative flex items-center">
              <select aria-label="Your trade" className={cn(field, "w-full cursor-pointer appearance-none pr-9")} value={draft.trade} onChange={(e) => setDraft({ ...draft, trade: e.target.value as TradeId })}>
                {trades.map((t) => <option key={t.id} value={t.id} className="text-black">{t.label}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 text-on-ink/70" aria-hidden />
            </span>
            <button type="submit" className="h-11 rounded-lg bg-accent px-4 text-[15px] font-medium whitespace-nowrap text-white hover:opacity-90">Rewrite the page</button>
          </form>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-on-ink/25 px-3.5 text-[14px] hover:bg-on-ink/10"><Pencil size={14} />Change</button>
            <button type="button" onClick={reset} className="h-10 rounded-lg px-3.5 text-[14px] text-on-ink/70 hover:text-on-ink">Back to the example</button>
          </div>
        )}
      </Container>
    </section>
  );
}

// ---------- Rides along while they scroll ----------

/** A pill at the bottom of the screen once the hero is gone, after they've named their business. */
export function PersonaChip() {
  const { p, clear } = usePersona();
  const [past, setPast] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    const on = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => setPast(window.scrollY > 720)); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf.current); };
  }, []);
  if (!p.named || !past) return null;
  return (
    <div className="rise fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-1 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-[13.5px] text-on-ink shadow-float">
        <span className="truncate">Previewing as <b className="font-medium">{p.name}</b><span className="text-on-ink/60"> · {p.city}</span></span>
        <button type="button" onClick={focusCapture} className="ml-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 hover:bg-on-ink/10"><Pencil size={13} />Edit</button>
        <button type="button" onClick={clear} aria-label="Back to the example business" className="grid size-8 shrink-0 place-items-center rounded-full text-on-ink/70 hover:bg-on-ink/10 hover:text-on-ink"><XIcon size={15} /></button>
      </div>
    </div>
  );
}

/** Under the hero mock, once it carries their name: a picture of the goal, not their live ranking. */
export function PreviewNote() {
  const { p } = usePersona();
  if (!p.named) return null;
  return (
    <p className="mx-auto mt-3 max-w-[480px] text-center text-[12.5px] text-muted">
      A preview of where Marko aims to get <Mine>{p.name}</Mine>, not your live ranking. <a href="#audit" className="font-medium text-fg underline underline-offset-2">Your free audit</a> shows where you stand today.
    </p>
  );
}
