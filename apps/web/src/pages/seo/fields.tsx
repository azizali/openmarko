// Form fields SEO setup and SEO settings share: the business's services, and how its checks run (within the Plan),
// plus connecting Google and a sentence saying what the checks cover.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { CircleAlert, Plus, X } from "lucide-react";
import { Button, Checkbox, Field, Input, Segmented } from "../../components/ui";
import { Feedback, useFeedback } from "../../components/Feedback";
import { api, messageOf } from "../../lib/api";
import { engineNames, locationApi, seoApi, type Engine, type Limits } from "./api";
import { GRID_SIZE, GRID_SPOTS, gridCoverage, metresOf, nearestReach, reaches } from "./distance";
import { GridMap, spotsOf } from "./GridMap";

export { GRID_SIZE, GRID_SPOTS, gridCoverage, nearestReach };

/** Spots a side the grid can have (the API takes these); the Plan's grid limit caps it. */
export const gridSizes = [5, 7, 9];
/** The sizes the Plan allows: its ceiling, or every size when it has none. */
export const allowedGridSizes = (limits: Limits | null) => gridSizes.filter((s) => limits?.gridSize == null || s <= limits.gridSize);
/** A stored size, brought within what the Plan allows now (the largest allowed when it's above). */
export const allowedGridSize = (size: number, limits: Limits | null) => {
  const ok = allowedGridSizes(limits);
  return ok.includes(size) ? size : (ok[ok.length - 1] ?? gridSizes[0]!);
};

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

/**
 * The Maps grid: how many spots a side (within the Plan) and how far it reaches, with what a check costs and, given
 * where the business is, a map of where it will search.
 */
export function GridFields({
  value,
  onChange,
  limits,
  mapsKeywords,
  center,
}: {
  value: Checks;
  onChange: (v: Checks) => void;
  limits: Limits | null;
  /** How many keywords are searched on Maps, to say what one check costs in searches; left out where unknown. */
  mapsKeywords?: number;
  /** Where the business is: the middle spot. Left out, no map. */
  center?: { lat: number; lng: number } | null;
}) {
  const sizes = allowedGridSizes(limits);
  const spots = value.gridSize * value.gridSize;
  return (
    <div className="space-y-5">
      <Field
        label="Map grid size"
        hint={
          <>
            Google Maps is searched from each of the {spots} spots
            {mapsKeywords !== undefined && (
              <>
                , for each keyword: {n(mapsKeywords, "keyword", "keywords")} × {spots} = {fmtN(mapsKeywords * spots)} searches a check
              </>
            )}
            . More spots show more detail, and cost more searches.
            {sizes.length < gridSizes.length && ` Your plan allows up to ${sizes[sizes.length - 1]} × ${sizes[sizes.length - 1]}.`}
          </>
        }
      >
        <Segmented
          label="Map grid size"
          value={String(value.gridSize)}
          onChange={(v) => onChange({ ...value, gridSize: Number(v) })}
          options={sizes.map((s) => ({ id: String(s), label: `${s} × ${s}` }))}
        />
      </Field>
      <Field label="How far the grid reaches" hint={gridCoverage(value.gridRadiusM, value.gridSize)}>
        <Segmented
          label="How far the grid reaches"
          value={String(nearestReach(value.gridRadiusM))}
          onChange={(v) => onChange({ ...value, gridRadiusM: Number(v) })}
          options={reaches.map((mi) => ({ id: String(metresOf(mi)), label: `${mi} mi` }))}
        />
      </Field>
      {center && <GridMap size={value.gridSize} spots={spotsOf(center, value.gridSize, value.gridRadiusM)} />}
    </div>
  );
}

/** How the checks run: the grid (unless shown elsewhere on the page), how often, and which assistants, within the Plan. */
export function ChecksFields({
  value,
  onChange,
  limits,
  mapsKeywords,
  center,
  grid = true,
}: {
  value: Checks;
  onChange: (v: Checks) => void;
  limits: Limits | null;
  mapsKeywords?: number;
  center?: { lat: number; lng: number } | null;
  /** False when the page shows GridFields beside its Maps keywords instead. */
  grid?: boolean;
}) {
  const everies = (["daily", "weekly", "monthly"] as Every[]).filter(
    (e) => limits?.checksPerMonth == null || perMonth[e] <= limits.checksPerMonth,
  );
  return (
    <div className="space-y-5">
      {grid && <GridFields value={value} onChange={onChange} limits={limits} mapsKeywords={mapsKeywords} center={center} />}
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
  const spots = c.gridSize * c.gridSize;
  return `${everyLabel[c.checkEvery]}: ${n(counts.maps, "keyword", "keywords")} from ${spots} spots on Google Maps (${fmtN(counts.maps * spots)} searches), ${n(counts.organic, "keyword", "keywords")} on Google search, and ${n(counts.questions, "question", "questions")} to ${n(c.engines.length, "assistant", "assistants")}.`;
}

/**
 * The categories to track, from Google's own list: typing searches it and only a name in it is accepted (any text,
 * when the list can't be read). `suggestions` are offered as one-click additions; `note` says why fewer are offered.
 */
export function CategoriesField({
  orgId,
  value,
  onChange,
  suggestions,
  note,
}: {
  orgId: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  note?: string | null;
}) {
  const lookup = useCallback(
    async (q: string) => {
      const r = await seoApi(orgId).categories.get({ query: { q } });
      return r.data?.ready ? r.data.categories : null;
    },
    [orgId],
  );
  return (
    <Field
      label="Categories to track"
      hint="Google files every business under categories from a fixed list. Type to find yours; keywords are built from each one kept here."
    >
      <ServicesField noun="category" nouns="categories" value={value} onChange={onChange} suggestions={suggestions} lookup={lookup} />
      {/* Not a failure: a note, by the field it's about, on why fewer categories are offered. */}
      {note && (
        <p className="mt-2 flex gap-1.5 text-[12.5px] text-warn">
          <CircleAlert size={14} className="mt-px shrink-0" aria-hidden />
          <span>Fewer categories to choose from: {note}</span>
        </p>
      )}
    </Field>
  );
}

/**
 * The places to track, from Google's own list: "Springfield, IL", so a name used in several states is never mistaken.
 * Places in the business's own state are offered first.
 */
export function CitiesField({
  orgId,
  locationId,
  value,
  onChange,
  suggestions,
}: {
  orgId: string;
  locationId: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
}) {
  const lookup = useCallback(
    async (q: string) => {
      const r = await locationApi(orgId, locationId).cities.get({ query: { q } });
      return r.data?.ready ? r.data.cities : null;
    },
    [orgId, locationId],
  );
  return (
    <Field label="Cities and towns to track" hint="Where your customers are. Type a name; each comes with its state, like Springfield, IL.">
      <ServicesField noun="city" nouns="cities and towns" value={value} onChange={onChange} suggestions={suggestions} lookup={lookup} />
    </Field>
  );
}
