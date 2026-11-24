// Actions: the suggestions every Improve tool writes, as cards to act on. The Action plan (/seo/plan) lists them all
// with filters; the overview shows the first few. Each card says what to do, why, which checks it should move and
// where it came from, and is applied with its button right on the card. One done by hand (a listing, a site fix) is
// marked done instead. An applied one stays in place saying so, with Undo, and is listed under Done from the next visit.
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Check, ChevronRight, Copy } from "lucide-react";
import { Badge, Button, Card, Textarea, cn } from "../../components/ui";
import { Feedback, useFeedback, useToast } from "../../components/Feedback";
import { fmtDate, messageOf } from "../../lib/api";
import { seoApi, type Suggestion } from "./api";
import { CheckIcon } from "./parts";
import { useSeo, useSeoHref, useSeoNavigate } from "./Seo";

export type Helps = "maps" | "keywords" | "ai";
export type Source = Suggestion["source"];

/** Where an action should move you, as its card says it: "for Google Maps and AI answers". */
export const helpsNames: Record<Helps, string> = { maps: "Google Maps", keywords: "Google search", ai: "AI answers" };
/** Where actions come from, as the Action plan's filter names them. */
export const sourceNames: Record<Source, string> = {
  audit: "Site audit",
  profile: "Google profile",
  tracking: "Tracking",
  listings: "Listings",
};

/** What each kind of action is called, its button, and what it says once done. */
const kinds: Record<string, { label: string; action: string; done: string; needs: "track" | "publish" }> = {
  track_keyword: {
    label: "Track a keyword",
    action: "Track it",
    done: "Tracking. First result in a few minutes.",
    needs: "track",
  },
  track_question: {
    label: "Track an AI question",
    action: "Track it",
    done: "Tracking. First answers in a few minutes.",
    needs: "track",
  },
  profile_change: {
    label: "Change your Google profile",
    action: "Apply to Google",
    done: "Sent to Google. Changes can take a day to show.",
    needs: "publish",
  },
  post: {
    label: "Post on your Google profile",
    action: "Publish",
    done: "Published on your Google profile.",
    needs: "publish",
  },
  listing: {
    label: "Get listed",
    action: "Mark as done",
    done: "Marked as done.",
    needs: "track",
  },
  site_fix: {
    label: "Fix your website",
    action: "Mark as done",
    done: "Marked as done. The next site audit checks it.",
    needs: "track",
  },
};
export const kindOf = (s: Suggestion) => kinds[s.kind] ?? kinds.listing!;

const list = (names: string[]) => (names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
/** "Google Maps and AI answers": every check an action should move. */
export const helpsLine = (s: Suggestion) => list(s.helpsAll.map((h) => helpsNames[h as Helps] ?? h));

/**
 * Actions as cards, keeping the ones applied on this visit where they were (saying what happened, with Undo) instead of
 * jumping to Done. `empty` is what to say when none are shown.
 */
export function ActionList({ open, onChange, empty }: { open: Suggestion[]; onChange: () => Promise<void>; empty: ReactNode }) {
  const [settled, setSettled] = useState<Record<string, { s: Suggestion; at: number }>>({});
  const shown: { s: Suggestion; applied: boolean }[] = open.filter((s) => !settled[s.id]).map((s) => ({ s, applied: false }));
  for (const { s, at } of Object.values(settled).toSorted((a, b) => a.at - b.at))
    shown.splice(Math.min(at, shown.length), 0, { s, applied: true });

  const applied = async (s: Suggestion) => {
    setSettled((m) => ({ ...m, [s.id]: { s, at: shown.findIndex((x) => x.s.id === s.id) } }));
    await onChange();
  };
  const undone = async (s: Suggestion) => {
    setSettled((m) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== s.id)));
    await onChange();
  };
  return (
    <div className="space-y-3">
      {shown.map(({ s, applied: isApplied }) => (
        <SuggestionCard key={s.id} s={s} applied={isApplied} onApplied={applied} onUndone={undone} onChange={onChange} />
      ))}
      {shown.length === 0 && <Card className="text-center">{empty}</Card>}
    </div>
  );
}

/**
 * One action, ready to apply: what kind it is, what to do, why, and its button. What it was based on (a post's text,
 * to edit before it goes out; a site fix's steps and what to paste) opens under Details. Once applied it says so in
 * place, with Undo.
 */
function SuggestionCard({
  s,
  applied,
  onApplied,
  onUndone,
  onChange,
}: {
  s: Suggestion;
  applied: boolean;
  onApplied: (s: Suggestion) => Promise<void>;
  onUndone: (s: Suggestion) => Promise<void>;
  onChange: () => Promise<void>;
}) {
  const { orgId, location, can } = useSeo();
  const go = useSeoNavigate();
  const toast = useToast();
  const fb = useFeedback();
  const k = kindOf(s);
  const draft = s.kind === "post" ? String((s.payload as { text?: string }).text ?? "") : null;
  const [text, setText] = useState(draft ?? "");
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const allowed = can(k.needs);
  const blocked = s.needsProfile && !location.profileLinked;
  const one = seoApi(orgId).suggestions({ suggestionId: s.id });

  const act = async (what: "apply" | "dismiss") => {
    setBusy(true);
    fb.clear();
    const r = what === "apply" ? await one.apply.post(draft !== null && text !== draft ? { text } : {}) : await one.dismiss.post();
    setBusy(false);
    if (r.error) {
      const needsProfile = (r.error.value as { details?: { needs?: string } } | undefined)?.details?.needs === "profile.manage";
      return fb.fail(
        needsProfile ? "Link this location's Google profile in Search settings first." : messageOf(r.error),
        what === "apply" ? "Could not apply" : "Could not dismiss",
      );
    }
    setDetails(false);
    if (what === "apply") await onApplied(s);
    else await onChange();
  };
  const undo = async () => {
    setBusy(true);
    const r = await one.undo.post();
    setBusy(false);
    if (r.error) return toast.error(messageOf(r.error), "Could not undo");
    await onUndone(s);
  };

  // A post goes out under the business's name, so its text is read before Publish.
  const mustReview = draft !== null && !details;
  return (
    <Card pad={false} className="p-4 sm:p-5">
      <h3 className="text-[15px] leading-snug font-medium text-balance">{s.title}</h3>
      <p className="mt-1 max-w-[68ch] text-[13px] text-muted">{s.why}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1">
          {s.helpsAll.map((h) => (
            <HelpsIcon key={h} helps={h} />
          ))}
        </span>
        {k.label}
        <span aria-hidden>·</span>
        <span>for {helpsLine(s)}</span>
      </p>
      {details && !applied && (
        <div className="anim-fade mt-3 border-t border-line pt-3">
          <p className="text-[12.5px] font-medium">Based on</p>
          <ul className="mt-1.5 space-y-1 text-[13.5px] break-words text-muted">
            {s.evidence.map((e) => (
              <li key={e} className="flex gap-2">
                <span className="mt-[9px] size-1 shrink-0 rounded-full bg-subtle" />
                <span className="min-w-0">{e}</span>
              </li>
            ))}
          </ul>
          {s.kind === "profile_change" && <BeforeAfter payload={s.payload as ProfileChange} />}
          {s.kind === "site_fix" && <SiteFixSteps fix={s.payload as SiteFix} />}
          {draft !== null && (
            <label className="mt-4 block">
              <span className="text-[12.5px] font-medium">The post (edit it if you like)</span>
              <Textarea
                className="mt-1.5 w-full"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!allowed || blocked}
              />
            </label>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {applied ? (
          <>
            <Badge tone="good" className="min-h-7 px-2.5 text-[13px]">
              <Check size={14} aria-hidden /> {k.done}
            </Badge>
            {can(k.needs) && (
              <Button variant="ghost" size="sm" onClick={() => void undo()} disabled={busy}>
                Undo
              </Button>
            )}
          </>
        ) : (
          <>
            {allowed && blocked && (
              <>
                <span className="text-[13px] text-muted">Needs your Google profile linked.</span>
                {can("manage") && (
                  <Button size="sm" onClick={() => go("/seo/settings")}>
                    Link it
                  </Button>
                )}
              </>
            )}
            {allowed && !blocked && (
              <Button
                variant="primary"
                onClick={() => (mustReview ? setDetails(true) : void act("apply"))}
                disabled={busy || (draft !== null && details && text.trim().length < 20)}
              >
                {mustReview ? "Review the post" : k.action}
              </Button>
            )}
            {can("track") && (
              <Button variant="ghost" onClick={() => void act("dismiss")} disabled={busy}>
                Not now
              </Button>
            )}
            <button
              type="button"
              onClick={() => setDetails(!details)}
              aria-expanded={details}
              className="ml-auto inline-flex min-h-9 items-center gap-1 text-[13px] text-muted hover:text-fg"
            >
              {details ? "Hide details" : s.kind === "site_fix" ? "How to fix it" : "Details"}
              <ChevronRight size={14} aria-hidden className={cn("transition-transform", details && "rotate-90")} />
            </button>
            <Feedback {...fb.props} />
          </>
        )}
      </div>
    </Card>
  );
}

function HelpsIcon({ helps }: { helps: string }) {
  return <CheckIcon check={helps in helpsNames ? (helps as Helps) : "maps"} size={13} />;
}

type ProfileChange = { field: "categories"; before: string[]; after: string[] } | { field: "description"; before: string; after: string };

const shown = (v: string | string[]) => (Array.isArray(v) ? v.join(", ") : v) || "Nothing yet";

function BeforeAfter({ payload }: { payload: ProfileChange }) {
  const label = payload.field === "categories" ? "Categories" : "Description";
  return (
    <div className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
      <div>
        <p className="text-[12.5px] text-muted">{label} now</p>
        <p className="mt-1 text-[13.5px]">{shown(payload.before)}</p>
      </div>
      <div>
        <p className="text-[12.5px] text-good">{label} after</p>
        <p className="mt-1 text-[13.5px]">{shown(payload.after)}</p>
      </div>
    </div>
  );
}

export type SiteFix = { code: string; steps: string[]; snippet: { label: string; text: string } | null };

/** A site fix's steps, what to paste (with Copy), and a link to every page it's on. */
export function SiteFixSteps({ fix, linkToIssue = true }: { fix: SiteFix; linkToIssue?: boolean }) {
  const href = useSeoHref();
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-[12.5px] font-medium">How to fix it</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px] text-muted">
        {fix.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {fix.snippet && <Snippet label={fix.snippet.label} text={fix.snippet.text} />}
      {linkToIssue && (
        <Link
          to={href(`/seo/site-audit/${fix.code}`)}
          className="mt-3 inline-flex items-center gap-0.5 text-[13px] text-fg underline-offset-2 hover:underline"
        >
          See every page it's on
          <ChevronRight size={13} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Something to paste into the site, with a button to copy it. */
export function Snippet({ label, text }: { label: string; text: string }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied", label);
    } catch {
      toast.error("Select the text and copy it instead.", "Could not copy");
    }
  };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted">{label}</span>
        <Button size="sm" variant="ghost" icon={<Copy size={13} />} onClick={() => void copy()}>
          Copy
        </Button>
      </div>
      <pre className="mt-1 max-h-72 overflow-auto rounded-lg border border-line bg-hover/60 p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-fg">
        {text}
      </pre>
    </div>
  );
}

/** What was done in the last 30 days, each with Undo. */
export function DoneList({ done, onChange }: { done: Suggestion[]; onChange: () => Promise<void> }) {
  const { orgId, can } = useSeo();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const undo = async (s: Suggestion) => {
    setBusy(s.id);
    const r = await seoApi(orgId).suggestions({ suggestionId: s.id }).undo.post();
    setBusy(null);
    if (r.error) return toast.error(messageOf(r.error), "Could not undo");
    toast.success("Undone", s.title);
    await onChange();
  };
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-[13px] font-medium text-muted">Done ({done.length})</h3>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {done.map((s) => (
          <li key={s.id} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-good/40 text-good">
              <Check size={13} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px]">{s.title}</p>
              <p className="text-[12.5px] text-muted">
                {kindOf(s).done} {s.decidedAt && `· ${fmtDate(s.decidedAt)}`}
              </p>
            </div>
            {can(kindOf(s).needs) && (
              <Button variant="ghost" size="sm" onClick={() => void undo(s)} disabled={busy === s.id}>
                Undo
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
