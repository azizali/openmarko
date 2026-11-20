// A form from a JSON Schema (the one each module's settings declare). Flat objects of strings, numbers, booleans,
// enums and string records are rendered; anything else is edited as JSON. Enough for every setting the modules ship
// with, and a safe fallback for new ones.
import { useState } from "react";
import { Button, Field, Input, Select, Textarea, Toggle } from "./ui";
import { Feedback, useFeedback } from "./Feedback";

export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  description?: string;
  additionalProperties?: JsonSchema | boolean;
  minimum?: number;
  maximum?: number;
};

const typeOf = (s: JsonSchema): string => (Array.isArray(s.type) ? (s.type.find((t) => t !== "null") ?? "string") : (s.type ?? "string"));
const label = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function SchemaForm({
  schema,
  value,
  onSave,
  busy,
}: {
  schema: JsonSchema;
  value: Record<string, unknown> | null;
  onSave: (next: Record<string, unknown>) => Promise<string | null>;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...value }));
  const [raw, setRaw] = useState<Record<string, string>>({});
  const fb = useFeedback();
  const props = schema.properties ?? {};
  const set = (k: string, v: unknown) => {
    fb.clear();
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    fb.clear();
    const next = { ...draft };
    // JSON-edited fields parse at save time, so a half-typed object never reaches the API.
    for (const [k, text] of Object.entries(raw)) {
      try {
        next[k] = text.trim() ? JSON.parse(text) : undefined;
      } catch {
        return fb.fail(`${label(k)} isn't valid JSON.`);
      }
    }
    const err = await onSave(next);
    if (err) fb.fail(err);
    else fb.succeed();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {Object.entries(props).map(([k, s]) => {
        const t = typeOf(s);
        const v = draft[k];
        const hint = s.description;
        if (s.enum) {
          return (
            <Field key={k} label={label(k)} hint={hint}>
              <Select value={String(v ?? s.default ?? "")} onChange={(e) => set(k, e.target.value)}>
                {s.enum.map((o) => (
                  <option key={String(o)} value={String(o)}>
                    {String(o)}
                  </option>
                ))}
              </Select>
            </Field>
          );
        }
        if (t === "boolean")
          return (
            <div key={k} className="flex items-center justify-between gap-4 rounded-lg border border-line px-3 py-2.5">
              <span>
                <span className="block text-[13.5px] font-medium">{label(k)}</span>
                {hint && <span className="block text-[12px] text-subtle">{hint}</span>}
              </span>
              <Toggle checked={!!(v ?? s.default)} onChange={(on) => set(k, on)} label={label(k)} />
            </div>
          );
        if (t === "string")
          return (
            <Field key={k} label={label(k)} hint={hint}>
              <Input
                value={String(v ?? "")}
                onChange={(e) => set(k, e.target.value)}
                placeholder={s.default ? String(s.default) : undefined}
              />
            </Field>
          );
        if (t === "number" || t === "integer")
          return (
            <Field key={k} label={label(k)} hint={hint}>
              <Input
                type="number"
                min={s.minimum}
                max={s.maximum}
                value={v === undefined || v === null ? "" : String(v)}
                onChange={(e) => set(k, e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </Field>
          );
        // Objects and arrays: JSON, with the current value as the starting text.
        return (
          <Field key={k} label={label(k)} hint={hint ? `${hint} (JSON)` : "JSON"}>
            <Textarea
              mono
              rows={5}
              value={raw[k] ?? JSON.stringify(v ?? s.default ?? (t === "array" ? [] : {}), null, 2)}
              onChange={(e) => (fb.clear(), setRaw((r) => ({ ...r, [k]: e.target.value })))}
            />
          </Field>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Feedback {...fb.props} />
      </div>
    </form>
  );
}
