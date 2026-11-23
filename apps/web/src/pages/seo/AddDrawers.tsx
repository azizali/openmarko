// The side panels for adding to what a Location tracks: keywords (Maps and Keywords pages), questions (AI answers)
// and a competitor (Competitors). Keywords and questions are typed one per line; each line says if it's already
// tracked, and the count stays within the Plan. A competitor is picked from a Google search near the Location.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { Badge, Button, Drawer, Field, Input, Textarea, cn, fmt } from "../../components/ui";
import { Feedback, useFeedback } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, type Ideas, type Place } from "./api";
import { useSeo } from "./Seo";

const lines = (s: string) => [
  ...new Set(
    s
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  ),
];
const normal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** What the panels share: a list typed one per line, checked against what's tracked and the Plan's limit. */
function LinesDrawer({
  open,
  onClose,
  title,
  label,
  placeholder,
  tracked,
  limit,
  inUse,
  free,
  freeNote,
  ideas,
  hint,
  submit,
  noun,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  label: string;
  placeholder: string;
  tracked: string[];
  limit: number | null;
  /** What already counts against the limit, when that's more than `tracked` (keywords: Maps and search share it). */
  inUse?: number;
  /** Lines that can be added without counting against the limit (a keyword already tracked in the other place). */
  free?: string[];
  /** Said beside a free line. */
  freeNote?: string;
  ideas: { text: string; note?: string }[];
  hint?: (line: string) => string | null;
  submit: (items: string[]) => Promise<{ error?: string }>;
  noun: [string, string];
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback(open);
  const { location } = useSeo();
  useEffect(() => {
    if (!open) setText("");
  }, [open]);
  const have = useMemo(() => new Set(tracked.map(normal)), [tracked]);
  const typed = lines(text);
  const fresh = typed.filter((l) => !have.has(normal(l)));
  const freeSet = useMemo(() => new Set((free ?? []).map(normal)), [free]);
  const used = inUse ?? tracked.length;
  const counted = fresh.filter((l) => !freeSet.has(normal(l))).length;
  const room = limit === null ? Infinity : Math.max(0, limit - used);
  const over = counted > room;
  const name = (n: number) => `${n} ${n === 1 ? noun[0] : noun[1]}`;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!fresh.length || over) return;
    setBusy(true);
    const r = await submit(fresh);
    setBusy(false);
    if (r.error) return fb.fail(r.error, "Could not add");
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      onSubmit={save}
      feedback={<Feedback {...fb.props} />}
      footer={
        <>
          <span className={cn("mr-auto text-[12.5px]", over ? "text-bad" : "text-muted")}>
            {limit === null ? `${name(tracked.length)} tracked` : `${used + counted} of ${limit} on your plan`}
          </span>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !fresh.length || over}>
            {busy ? "Adding…" : fresh.length ? `Add ${name(fresh.length)}` : "Add"}
          </Button>
        </>
      }
    >
      <Field
        label={label}
        hint={`One per line. ${location.status === "active" ? "The first result comes in a few minutes." : "Checks are paused here: results come once they're resumed in Settings."}`}
      >
        <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus />
      </Field>
      {typed.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[13px]">
          {typed.map((l) => (
            <li key={l} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{l}</span>
              {have.has(normal(l)) ? (
                <Badge>Already tracked</Badge>
              ) : freeSet.has(normal(l)) && freeNote ? (
                <span className="shrink-0 text-[12px] text-muted">{freeNote}</span>
              ) : hint?.(l) ? (
                <span className="shrink-0 text-[12px] text-muted">{hint(l)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {over && (
        <p className="mt-3 text-[13px] text-bad">
          Your plan has room for {name(room)} more. Remove some lines, or stop tracking others first.
        </p>
      )}
      {ideas.length > 0 && (
        <div className="mt-6">
          <p className="text-[12.5px] font-medium text-muted">Ideas</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ideas
              .filter((i) => !have.has(normal(i.text)) && !typed.some((l) => normal(l) === normal(i.text)))
              .map((i) => (
                <li key={i.text}>
                  <button
                    type="button"
                    onClick={() => setText((t) => (t.trim() ? `${t.trim()}\n${i.text}` : i.text))}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] hover:border-line-strong hover:bg-hover"
                  >
                    <Plus size={12} aria-hidden />
                    {i.text}
                    {i.note && <span className="num text-muted">{i.note}</span>}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}

/** Ideas for what to track, from the business (asks the API once per opening; only for people who manage SEO). */
function useIdeas(open: boolean) {
  const { orgId, location, can } = useSeo();
  const [ideas, setIdeas] = useState<Ideas | null>(null);
  // Asked once per Location: the request costs money, and `can` changes identity on every render.
  const asked = useRef<string | null>(null);
  const manage = can("manage");
  useEffect(() => {
    if (!open || !manage || asked.current === location.id) return;
    asked.current = location.id;
    setIdeas(null);
    void locationApi(orgId, location.id)
      .ideas.get()
      .then((r) => {
        if (r.data) setIdeas(r.data);
        else asked.current = null; // a failed request may be asked again on the next opening
      });
  }, [open, manage, orgId, location.id]);
  return ideas;
}

/** Where keywords are searched: each page adds its own, typed the way people search there. */
const surfaces = {
  maps: { title: "Add Google Maps keywords", placeholder: "emergency dentist\ninvisalign", flags: { maps: true, organic: false } },
  organic: {
    title: "Add Google search keywords",
    placeholder: "emergency dentist austin\ninvisalign cost austin",
    flags: { maps: false, organic: true },
  },
} as const;

export function AddKeywords({
  on,
  open,
  onClose,
  tracked,
  limit,
  onAdded,
}: {
  /** Google Maps (searched from every spot of the grid) or Google search. */
  on: "maps" | "organic";
  open: boolean;
  onClose: () => void;
  tracked: string[];
  limit: number | null;
  onAdded: () => void;
}) {
  const { orgId, location } = useSeo();
  const ideas = useIdeas(open);
  // The Plan's limit is shared by Maps and search: every active keyword counts once, and one tracked in the other
  // place is turned on here too without counting again.
  const all = useLoad(
    () => (open ? locationApi(orgId, location.id).keywords.get() : Promise.resolve({ data: null, error: null })),
    [open, orgId, location.id],
  );
  const elsewhere = (all.data ?? []).filter((k) => !k[on]).map((k) => k.term);
  return (
    <LinesDrawer
      open={open}
      onClose={onClose}
      title={surfaces[on].title}
      label="Keywords"
      placeholder={surfaces[on].placeholder}
      tracked={tracked}
      limit={limit}
      inUse={all.data?.length}
      free={elsewhere}
      freeNote={on === "maps" ? "On Google search too; doesn't count again" : "On Google Maps too; doesn't count again"}
      noun={["keyword", "keywords"]}
      ideas={(ideas?.[on] ?? []).map((k) => ({ text: k.term, note: k.monthlySearches ? `${fmt(k.monthlySearches)}/mo` : undefined }))}
      submit={async (terms) => {
        const r = await locationApi(orgId, location.id).keywords.post({ terms, ...surfaces[on].flags });
        if (r.error) return { error: messageOf(r.error) };
        onAdded();
        return {};
      }}
    />
  );
}

export function AddQuestions({
  open,
  onClose,
  tracked,
  limit,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  tracked: string[];
  limit: number | null;
  onAdded: () => void;
}) {
  const { orgId, location } = useSeo();
  const ideas = useIdeas(open);
  return (
    <LinesDrawer
      open={open}
      onClose={onClose}
      title="Add questions"
      label="Questions, the way a customer would ask them"
      placeholder={"Who is the best emergency dentist in Austin?\nWhich dentists near me take new patients?"}
      tracked={tracked}
      limit={limit}
      noun={["question", "questions"]}
      ideas={(ideas?.questions ?? []).map((text) => ({ text }))}
      hint={(l) => (!l.includes("?") && l.split(/\s+/).length <= 4 ? "Reads like a keyword; add it on Keywords" : null)}
      submit={async (texts) => {
        const r = await locationApi(orgId, location.id).questions.post({ texts });
        if (r.error) return { error: messageOf(r.error) };
        onAdded();
        return {};
      }}
    />
  );
}

export function AddCompetitor({
  open,
  onClose,
  known,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  known: string[];
  onAdded: () => void;
}) {
  const { orgId, location } = useSeo();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fb = useFeedback(open);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setFound(null);
    }
  }, [open]);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy("search");
    const r = await locationApi(orgId, location.id).competitors.find.post({ query });
    setBusy(null);
    if (r.error) return fb.fail(messageOf(r.error), "Could not search");
    setFound(r.data);
  };
  const add = async (place: Place) => {
    setBusy(place.placeId);
    const r = await locationApi(orgId, location.id).competitors.overrides.post({ action: "added", place });
    setBusy(null);
    if (r.error) return fb.fail(messageOf(r.error), "Could not add");
    onAdded();
    onClose();
  };
  const knownNames = new Set(known.map(normal));

  return (
    <Drawer open={open} onClose={onClose} title="Add a competitor" onSubmit={search} feedback={<Feedback {...fb.props} />}>
      <p className="text-[13.5px] text-muted">
        Competitors are found for you from every check. Add one only if it's missing; it shows as Added by you until the next check.
      </p>
      <Field label="Business name" className="mt-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or street"
            icon={<Search size={14} />}
            autoFocus
          />
          <Button type="submit" disabled={busy === "search" || query.trim().length < 2}>
            {busy === "search" ? "Searching…" : "Search"}
          </Button>
        </div>
      </Field>
      {found && (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {found.length === 0 && (
            <li className="px-3 py-3 text-[13px] text-muted">Nothing found near {location.city ?? "you"}. Try another name.</li>
          )}
          {found.map((p) => {
            const isYou = p.placeId === location.googlePlaceId;
            const already = knownNames.has(normal(p.name));
            return (
              <li key={p.placeId} className="flex items-start gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{p.name}</p>
                  <p className="truncate text-[12.5px] text-muted">
                    {[p.category, p.address].filter(Boolean).join(" · ")}
                    {p.rating !== null && ` · ${p.rating.toFixed(1)}★ (${fmt(p.reviewCount ?? 0)})`}
                  </p>
                </div>
                {isYou ? (
                  <Badge>You</Badge>
                ) : already ? (
                  <Badge>Already a competitor</Badge>
                ) : (
                  <Button type="button" size="sm" onClick={() => void add(p)} disabled={!!busy}>
                    {busy === p.placeId ? "Adding…" : "Add"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
