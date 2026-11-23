// Form fields SEO setup and SEO settings share: the business's services, and how its checks run (within the Plan),
// plus connecting Google and a sentence saying what the checks cover.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Plus, X } from "lucide-react";
import { Button, Checkbox, Field, Input, Segmented } from "../../components/ui";
import { Feedback, useFeedback } from "../../components/Feedback";
import { api, messageOf } from "../../lib/api";
import { engineNames, type Engine, type Limits } from "./api";

export const engines: Engine[] = ["chatgpt", "google_ai", "perplexity"];
export type Every = "daily" | "weekly" | "monthly";
export const everyLabel: Record<Every, string> = { daily: "Every day", weekly: "Every week", monthly: "Every month" };
const perMonth: Record<Every, number> = { daily: 30, weekly: 4, monthly: 1 };

/** Says why Google's sign-in came back without connecting (`?oauth_error=` on the address it returned to). */
export function useOAuthError(say: (text: string) => void) {
  const [params] = useSearchParams();
  const error = params.get("oauth_error");
  // Said once per error, however often `say` changes.
  const said = useRef<string | null>(null);
  useEffect(() => {
    if (!error || said.current === error) return;
    said.current = error;
    say(error === "cancelled" || error === "access_denied" ? "Google sign-in was cancelled." : error);
  }, [error, say]);
}

/** Sends the browser to sign in to Google; it comes back to `returnTo` (at once, when the app has no Google client). */
export async function connectGoogle(orgId: string, returnTo: string): Promise<string | null> {
  const r = await api.api.v1.organizations({ orgId }).connections.oauth({ providerId: "google_business" }).post({ returnTo });
  if (r.error) return messageOf(r.error);
  window.location.assign(r.data.url);
  return null;
}

/**
 * What the business offers (or, with other words, the categories and cities to track): removable chips and a row to
 * add one. Ideas and suggestions come from these. `suggestions` are offered as one-click additions.
 */
export function ServicesField({
  value,
  onChange,
  noun = "service",
  nouns = `${noun}s`,
  suggestions = [],
  lookup,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  noun?: string;
  /** The plural, for the message when text isn't in the list. */
  nouns?: string;
  suggestions?: string[];
  /**
   * For a fixed list (Google's categories, its cities): what matches the typed text, or null when the list isn't available (then
   * anything is accepted). With it, only a name from the list can be added.
   */
  lookup?: (typed: string) => Promise<string[] | null>;
}) {
  const [draft, setDraft] = useState("");
  const has = (v: string) => value.some((s) => s.toLowerCase() === v.toLowerCase());
  // What the list says matches the typed text (null: no list, anything goes), and why the last add was refused.
  const [matches, setMatches] = useState<string[] | null>(null);
  const fb = useFeedback();
  useEffect(() => {
    if (!lookup || !draft.trim()) return setMatches(null);
    let current = true;
    const timer = setTimeout(() => void lookup(draft).then((m) => current && setMatches(m)), 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [draft, lookup]);
  const add = (text = draft) => {
    const typed = text.trim();
    if (!typed) return;
    // From a fixed list, the name as the list spells it; text the list doesn't have is refused.
    const v = matches ? (matches.find((m) => m.toLowerCase() === typed.toLowerCase()) ?? null) : typed;
    if (v === null) return fb.fail(`That isn't in Google's list of ${nouns}. Pick one from the suggestions.`);
    if (!has(v)) onChange([...value, v]);
    fb.clear();
    setDraft("");
  };
  const offered = (draft.trim() && matches ? matches : suggestions).filter((x) => !has(x)).slice(0, 12);
  return (
    <div>
      <ul className="flex flex-wrap gap-1.5">
        {value.map((s) => (
          <li key={s} className="inline-flex items-center gap-1 rounded-full border border-line py-0.5 pr-1 pl-2.5 text-[13px]">
            {s}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== s))}
              aria-label={`Remove ${s}`}
              className="grid size-5 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg"
            >
              <X size={12} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          size="sm"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            fb.clear();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Add a ${noun}`}
          aria-label={`Add a ${noun}`}
        />
        <Button type="button" size="sm" icon={<Plus size={14} />} onClick={() => add()} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      <Feedback {...fb.props} />
      {offered.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Suggested ${noun}s`}>
          {offered.map((x) => (
            <li key={x}>
              <button
                type="button"
                onClick={() => add(x)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-0.5 text-[13px] text-muted hover:bg-hover hover:text-fg"
              >
                <Plus size={12} aria-hidden /> {x}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type Checks = { gridSize: number; gridRadiusM: number; checkEvery: Every; engines: Engine[] };

/** Google Maps is searched from a 7 × 7 grid: one spot on the business's door, three rings around it. */
export const GRID_SIZE = 7;
export const GRID_SPOTS = GRID_SIZE * GRID_SIZE;
const M_PER_MILE = 1609.344;
/** How far the grid reaches, in miles: a dense city wants it tight, a business that drives to customers wants it wide. */
const reaches = [0.5, 1, 2, 3, 5, 10];
const metres = (miles: number) => Math.round(miles * M_PER_MILE);
const miles = (m: number) => {
  const mi = m / M_PER_MILE;
  return `${mi < 1 ? mi.toFixed(1).replace(/^0/, "") : mi.toFixed(mi < 10 ? 1 : 0).replace(/\.0$/, "")} mi`;
};
/** The preset nearest a stored reach, so one set elsewhere still shows as picked. */
export const nearestReach = (m: number) => metres(reaches.reduce((a, b) => (Math.abs(metres(b) - m) < Math.abs(metres(a) - m) ? b : a)));

/** What the grid covers, in a sentence: "Reaches 2 mi from the business each way (a 4 mi square); spots are 0.7 mi apart." */
export function gridCoverage(radiusM: number): string {
  return `Reaches ${miles(radiusM)} from the business each way (a ${miles(radiusM * 2)} square); spots are ${miles(radiusM / ((GRID_SIZE - 1) / 2))} apart.`;
}

/** The 7 × 7 grid and how far it reaches, how often, and which assistants: only what the Plan allows is offered. */
export function ChecksFields({
  value,
  onChange,
  limits,
  mapsKeywords,
}: {
  value: Checks;
  onChange: (v: Checks) => void;
  limits: Limits | null;
  /** How many keywords are searched on Maps, to say what one check costs in searches; left out where unknown. */
  mapsKeywords?: number;
}) {
  const everies = (["daily", "weekly", "monthly"] as Every[]).filter(
    (e) => limits?.checksPerMonth == null || perMonth[e] <= limits.checksPerMonth,
  );
  return (
    <div className="space-y-5">
      <Field
        label="Map grid: 7 × 7, how far it reaches"
        hint={
          <>
            {gridCoverage(value.gridRadiusM)} Google Maps is searched from each of the {GRID_SPOTS} spots
            {mapsKeywords !== undefined && (
              <>
                , for each keyword: {n(mapsKeywords, "keyword", "keywords")} × {GRID_SPOTS} = {fmtN(mapsKeywords * GRID_SPOTS)} searches a
                check
              </>
            )}
            .
          </>
        }
      >
        <Segmented
          label="How far the grid reaches"
          value={String(nearestReach(value.gridRadiusM))}
          onChange={(v) => onChange({ ...value, gridSize: GRID_SIZE, gridRadiusM: Number(v) })}
          options={reaches.map((mi) => ({ id: String(metres(mi)), label: `${mi} mi` }))}
        />
      </Field>
      <Field label="How often">
        <Segmented
          label="How often"
          value={value.checkEvery}
          onChange={(v) => onChange({ ...value, checkEvery: v })}
          options={everies.map((e) => ({ id: e, label: everyLabel[e] }))}
        />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">AI assistants asked</legend>
        <div className="flex flex-wrap gap-4">
          {engines.map((e) => (
            <label key={e} className="inline-flex items-center gap-2 text-[13.5px]">
              <Checkbox
                checked={value.engines.includes(e)}
                onChange={(on) => onChange({ ...value, engines: on ? [...value.engines, e] : value.engines.filter((x) => x !== e) })}
              />
              {engineNames[e]}
            </label>
          ))}
        </div>
      </fieldset>
      {everies.length < 3 && (
        <p className="text-[12.5px] text-muted">Your plan allows checks {everyLabel[everies[0] ?? "monthly"].toLowerCase()} at most.</p>
      )}
    </div>
  );
}

const fmtN = (k: number) => k.toLocaleString("en-US");
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** What each check covers, in a sentence: "Every week: 6 keywords from 49 spots on Google Maps, 20 on Google search, …". */
export function checkSummary(c: Checks, counts: { maps: number; organic: number; questions: number }): string {
  return `${everyLabel[c.checkEvery]}: ${n(counts.maps, "keyword", "keywords")} from ${GRID_SPOTS} spots on Google Maps (${fmtN(counts.maps * GRID_SPOTS)} searches), ${n(counts.organic, "keyword", "keywords")} on Google search, and ${n(counts.questions, "question", "questions")} to ${n(c.engines.length, "assistant", "assistants")}.`;
}
