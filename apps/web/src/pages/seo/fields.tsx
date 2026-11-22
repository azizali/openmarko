// Form fields SEO setup and SEO settings share: the business's services, and how its checks run (within the Plan),
// plus connecting Google and a sentence saying what the checks cover.
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Checkbox, Field, Input, Segmented } from "../../components/ui";
import { api, messageOf } from "../../lib/api";
import { engineNames, type Engine, type Limits } from "./api";

export const engines: Engine[] = ["chatgpt", "google_ai", "perplexity"];
export type Every = "daily" | "weekly" | "monthly";
export const everyLabel: Record<Every, string> = { daily: "Every day", weekly: "Every week", monthly: "Every month" };
const perMonth: Record<Every, number> = { daily: 30, weekly: 4, monthly: 1 };

/** Sends the browser to sign in to Google; it comes back to `returnTo` (at once, when the app has no Google client). */
export async function connectGoogle(orgId: string, returnTo: string): Promise<string | null> {
  const r = await api.api.v1.organizations({ orgId }).connections.oauth({ providerId: "google_business" }).post({ returnTo });
  if (r.error) return messageOf(r.error);
  window.location.assign(r.data.url);
  return null;
}

/** What the business offers: removable chips and a row to add one. Ideas and suggestions come from these. */
export function ServicesField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.some((s) => s.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setDraft("");
  };
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
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a service"
          aria-label="Add a service"
        />
        <Button type="button" size="sm" icon={<Plus size={14} />} onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

export type Checks = { gridSize: number; checkEvery: Every; engines: Engine[] };

/** Grid size, how often, and which assistants: only what the Plan allows is offered. */
export function ChecksFields({ value, onChange, limits }: { value: Checks; onChange: (v: Checks) => void; limits: Limits | null }) {
  const grids = [5, 7, 9].filter((n) => limits?.gridSize == null || n <= limits.gridSize);
  const everies = (["daily", "weekly", "monthly"] as Every[]).filter(
    (e) => limits?.checksPerMonth == null || perMonth[e] <= limits.checksPerMonth,
  );
  const capped = grids.length < 3 || everies.length < 3;
  return (
    <div className="space-y-5">
      <Field label="Map grid" hint={`Google Maps is searched from ${value.gridSize * value.gridSize} spots around the business.`}>
        <Segmented
          label="Map grid"
          value={String(value.gridSize)}
          onChange={(v) => onChange({ ...value, gridSize: Number(v) })}
          options={grids.map((n) => ({ id: String(n), label: `${n} × ${n}` }))}
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
      {capped && (
        <p className="text-[12.5px] text-muted">
          Your plan allows up to a {Math.max(...grids)} × {Math.max(...grids)} grid, checked{" "}
          {everyLabel[everies[0] ?? "monthly"].toLowerCase()} at most.
        </p>
      )}
    </div>
  );
}

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** What each check covers, in a sentence: "Every week: 8 keywords from 49 spots on Google Maps, …". */
export function checkSummary(c: Checks, keywords: number, questions: number): string {
  return `${everyLabel[c.checkEvery]}: ${n(keywords, "keyword", "keywords")} from ${c.gridSize * c.gridSize} spots on Google Maps, ${keywords} on Google search, and ${n(questions, "question", "questions")} to ${n(c.engines.length, "assistant", "assistants")}.`;
}
