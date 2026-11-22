// Detail pages of the SEO section (#/seo/keywords, /ai, /competitors); the map page is Maps.tsx.
// The overview gives one number per check; these show what is behind it: every keyword, every question,
// and who is ahead of you on each one. Competitors differ by keyword and by where the person searched.

import { Fragment, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, X } from "lucide-react";
import { Badge, Button, Card, cn, fmt, LineChart, rankTone, Segmented } from "../../components/ui";
import {
  ahead,
  aheadCount,
  aiNamed,
  baseKeywords,
  channels,
  columns,
  engines,
  field,
  GRID_SPOTS,
  googleTop10,
  score,
  sources,
  ranked,
  top3Spots,
  weekLabels,
  weekly,
  you,
  type Candidate,
  type Channel,
  type Site,
  type TrackedKeyword,
  type TrackedPrompt,
} from "../../mock/seo";

/** Up is good here: a count that grew, or a position that got smaller. */
export function Change({ by, unit }: { by: number; unit: string }) {
  if (by === 0) return <span className="text-[12.5px] text-muted">No change in 30 days</span>;
  const Icon = by > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12.5px] font-medium", by > 0 ? "text-good" : "text-bad")}>
      <Icon size={13} />
      {Math.abs(by)} {unit} in 30 days
    </span>
  );
}

export function Source({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 rounded-lg bg-hover px-3 py-2.5 text-[12.5px] leading-[1.5] text-muted">
      <span className="font-medium text-fg">Where this comes from. </span>
      {children}
    </p>
  );
}

/** The one number a check page leads with: its change over 30 days, a sentence, and the last 90 days beside it. */
export function Headline({
  label,
  value,
  by,
  byUnit = "",
  history,
  yMax,
  format = (n) => String(n),
  children,
}: {
  label: string;
  value: ReactNode;
  by: number;
  byUnit?: string;
  history: number[];
  yMax?: number;
  format?: (n: number) => string;
  children?: ReactNode;
}) {
  return (
    <Card className="mt-6 grid items-center gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <p className="text-[13px] text-muted">{label}</p>
        <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="num font-serif text-[44px] leading-none tracking-tight">{value}</span>
          <span
            className={cn(
              "num mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-medium",
              by > 0 ? "bg-good-soft text-good" : by < 0 ? "bg-bad-soft text-bad" : "bg-hover text-muted",
            )}
          >
            {by > 0 && <ArrowUp size={11} strokeWidth={2.5} />}
            {by < 0 && <ArrowDown size={11} strokeWidth={2.5} />}
            {by === 0 ? "No change" : `${Math.abs(by)}${byUnit}`} in 30 days
          </span>
        </div>
        {children && <p className="mt-2 text-[13px] text-muted">{children}</p>}
      </div>
      <LineChart
        height={120}
        labels={weekLabels}
        yMax={yMax}
        format={format}
        series={[{ name: label, color: "var(--accent)", values: history }]}
        area
      />
    </Card>
  );
}

const pillTone = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-hover text-muted",
};

function Position({ now, prev }: { now: number | null; prev: number | null }) {
  if (now === null) return <span className="text-muted">Not found</span>;
  const by = prev === null ? 0 : prev - now;
  return (
    <span className="num inline-flex items-center gap-1.5">
      <span
        className={cn("inline-grid h-6 min-w-8 place-items-center rounded-full px-1.5 text-[12px] font-medium", pillTone[rankTone(now)])}
      >
        {now}
      </span>
      {by !== 0 && (
        <span className={cn("inline-flex items-center text-[12px]", by > 0 ? "text-good" : "text-bad")}>
          {by > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(by)}
        </span>
      )}
    </span>
  );
}

/** One row of a ranking: a name, a bar and its number. Yours is the dark one. */
export function Bar({
  name,
  value,
  max,
  mine,
  active,
  onClick,
}: {
  name: ReactNode;
  value: number;
  max: number;
  mine?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className={cn("w-44 shrink-0 truncate text-left text-[13.5px]", mine && "font-medium")}>{name}</span>
      <span className="h-2 min-w-0 flex-1 rounded-full bg-hover">
        <span className={cn("block h-2 rounded-full", mine ? "bg-ink" : "bg-line-strong")} style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <span className="num w-8 shrink-0 text-right text-[13.5px]">{value}</span>
    </>
  );
  const cls = cn("flex w-full items-center gap-3 rounded-md px-2 py-1.5", active && "bg-hover");
  return onClick ? (
    <button onClick={onClick} aria-pressed={active} className={cn(cls, "hover:bg-hover")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const th = "py-2 font-normal";

// ---------- Keywords ----------

export function KeywordsPage({ keywords }: { keywords: TrackedKeyword[] }) {
  const [open, setOpen] = useState<string | null>(baseKeywords[0]!.id);
  const live = keywords.filter((k) => !k.pending);
  const onFirst = (p: number | null) => p !== null && p <= 10;
  const now = live.filter((k) => onFirst(k.google)).length;
  const before = live.filter((k) => onFirst(k.googlePrev)).length;
  return (
    <>
      <p className="max-w-2xl text-[13.5px] text-muted">
        Where your website shows in Google's normal results for each keyword. Open one to see the whole first page: other dentists, and
        directories like Yelp that often take the top places.
      </p>
      <Headline
        label="On Google's first page"
        value={
          <>
            {now}
            <span className="text-[24px] text-muted"> of {live.length}</span>
          </>
        }
        by={now - before}
        history={weekly(before, now)}
        yMax={live.length}
      />
      <Card pad={false} className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-muted">
              <th className={cn(th, "pl-4")}>Keyword</th>
              <th className={cn(th, "text-right")}>Searches / mo</th>
              <th className={cn(th, "text-right")}>Your position</th>
              <th className={cn(th, "pl-6")}>First on Google</th>
              <th className={cn(th, "text-right")}>Map top 3</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {keywords.map((k) => {
              if (k.pending)
                return (
                  <tr key={k.id} className="border-b border-line last:border-0">
                    <td className="py-3 pl-4">{k.term}</td>
                    <td className="num py-3 text-right text-muted">{fmt(k.volume)}</td>
                    <td colSpan={4} className="py-3 pr-4 text-right text-muted">
                      First check running
                    </td>
                  </tr>
                );
              const top = googleTop10(k);
              const first = top[0]!;
              const isOpen = open === k.id;
              return (
                <Fragment key={k.id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : k.id)}
                    className={cn("cursor-pointer hover:bg-hover", !isOpen && "border-b border-line")}
                  >
                    <td className="py-3 pl-4 font-medium">{k.term}</td>
                    <td className="num py-3 text-right text-muted">{fmt(k.volume)}</td>
                    <td className="py-3 text-right">
                      <Position now={k.google} prev={k.googlePrev} />
                    </td>
                    <td className="py-3 pl-6 text-muted">{first === "you" ? "You" : first.name}</td>
                    <td className="num py-3 text-right">
                      {top3Spots(k.id)} <span className="text-muted">/ {GRID_SPOTS}</span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <button
                        aria-label={`First page for ${k.term}`}
                        aria-expanded={isOpen}
                        className="rounded p-1 text-subtle hover:text-fg"
                      >
                        <ChevronRight size={15} className={cn("transition-transform", isOpen && "rotate-90")} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-line">
                      <td colSpan={6} className="bg-hover/50 px-4 pt-1 pb-4">
                        <p className="py-2 text-[12.5px] text-muted">
                          Google's first page for “{k.term}”
                          {k.google !== null && k.google > 10 && `. You are at ${k.google}, on page ${Math.ceil(k.google / 10)}.`}
                        </p>
                        <ol className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                          {top.map((s, i) => (
                            <li
                              key={s === "you" ? "you" : s.id}
                              className={cn("flex items-center gap-2 text-[13.5px]", s === "you" && "font-medium")}
                            >
                              <span className="num w-5 shrink-0 text-right text-muted">{i + 1}</span>
                              <span className="min-w-0 truncate">{s === "you" ? "You" : s.name}</span>
                              {s !== "you" && s.kind === "directory" && <Badge>Directory</Badge>}
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Source>{sources.keywords}</Source>
    </>
  );
}

// ---------- AI answers ----------

export function AiPage({ prompts }: { prompts: TrackedPrompt[] }) {
  const [open, setOpen] = useState<string | null>(prompts[0]?.id ?? null);
  const me = aiNamed(prompts);
  const pct = me.total ? Math.round((me.hits / me.total) * 100) : 0;
  // Mock: the check 30 days back named you in two fewer answers.
  const pctAgo = me.total ? Math.round((Math.max(0, me.hits - 2) / me.total) * 100) : 0;
  return (
    <>
      <p className="max-w-2xl text-[13.5px] text-muted">
        We ask each assistant the question the way a customer would, read who it names, and note the sites it leaned on. Open a question to
        read each answer.
      </p>
      <Headline
        label="Named in AI answers"
        value={
          <>
            {pct}
            <span className="text-[24px] text-muted">%</span>
          </>
        }
        by={pct - pctAgo}
        byUnit=" pts"
        history={weekly(pctAgo, pct, 3)}
        yMax={Math.ceil(pct / 10) * 10 + 20}
        format={(n) => `${n}%`}
      >
        {me.hits} of {me.total} answers name you.
      </Headline>

      <Card pad={false} className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-muted">
              <th className={cn(th, "pl-4")}>Question</th>
              {engines.map((e) => {
                const n = aiNamed(prompts, undefined, e.id);
                return (
                  <th key={e.id} className={cn(th, "px-2 text-center")}>
                    {e.name}
                    <span className="num block">
                      {n.hits} of {n.total}
                    </span>
                  </th>
                );
              })}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => {
              if (p.pending)
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-3 pl-4">{p.text}</td>
                    <td colSpan={engines.length + 1} className="py-3 pr-4 text-right text-muted">
                      First answers coming
                    </td>
                  </tr>
                );
              const isOpen = open === p.id;
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : p.id)}
                    className={cn("cursor-pointer hover:bg-hover", !isOpen && "border-b border-line")}
                  >
                    <td className="py-3 pl-4 font-medium">{p.text}</td>
                    {engines.map((e) => {
                      const a = p.answers[e.id];
                      return (
                        <td key={e.id} className="px-2 py-3 text-center">
                          {a.you ? (
                            <span
                              title={`Names you #${a.at}`}
                              className="num inline-grid h-6 min-w-8 place-items-center rounded-full bg-good-soft px-1.5 text-[12px] font-medium text-good"
                            >
                              #{a.at}
                            </span>
                          ) : (
                            <span
                              title="Doesn't name you"
                              className="inline-grid size-6 place-items-center rounded-full bg-hover text-subtle"
                            >
                              <X size={12} />
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3 pr-3 text-right">
                      <button aria-label={`Answers for ${p.text}`} aria-expanded={isOpen} className="rounded p-1 text-subtle hover:text-fg">
                        <ChevronRight size={15} className={cn("transition-transform", isOpen && "rotate-90")} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-line">
                      <td colSpan={engines.length + 2} className="bg-hover/50 px-4 py-4">
                        <div className="anim-fade grid gap-3 md:grid-cols-3">
                          {engines.map((e) => {
                            const a = p.answers[e.id];
                            return (
                              <div key={e.id} className={cn("rounded-lg border bg-surface p-3", a.you ? "border-good/30" : "border-line")}>
                                <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px] font-medium">
                                  {e.name}
                                  {a.you ? <Badge tone="good">Names you #{a.at}</Badge> : <Badge tone="bad">Not named</Badge>}
                                </div>
                                <p className="text-[12.5px] leading-relaxed text-muted italic">“{a.excerpt}”</p>
                                <ol className="mt-2 space-y-0.5 text-[12.5px]">
                                  {ranked(a).map((n, i) => (
                                    <li key={n} className={cn(n === you.name && "font-medium text-accent")}>
                                      <span className="num text-subtle">{i + 1}.</span> {n === you.name ? "You" : n}
                                    </li>
                                  ))}
                                </ol>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {a.cites.map((s) => (
                                    <span
                                      key={s}
                                      className={cn(
                                        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px]",
                                        s === you.website ? "bg-good-soft text-good" : "bg-hover text-muted",
                                      )}
                                    >
                                      <ExternalLink size={9} />
                                      {s === you.website ? "Your website" : s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Source>{sources.ai}</Source>
    </>
  );
}

// ---------- Competitors ----------

const cell = (channel: Channel, v: number | null) => (v === null || (channel !== "google" && v === 0) ? "–" : v);

/** A competitor's result next to yours, on one keyword or question. */
function Versus({ channel, label, theirs, yours }: { channel: Channel; label: string; theirs: number | null; yours: number | null }) {
  const beats = ahead(channel, theirs, yours);
  return (
    <li className="flex items-center gap-3 py-1.5 text-[13px]">
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      <span
        className={cn(
          "num inline-grid h-6 min-w-8 place-items-center rounded-full px-1.5 text-[12px] font-medium",
          beats ? "bg-bad-soft text-bad" : "bg-hover text-muted",
        )}
      >
        {cell(channel, theirs)}
      </span>
      <span className="num w-10 shrink-0 text-right text-muted">{cell(channel, yours)}</span>
    </li>
  );
}

export function CompetitorsPage({
  added = [],
  onRemove,
}: {
  /** Competitors added by hand: read from the next check, no numbers yet. */
  added?: Candidate[];
  onRemove?: (id: string) => void;
}) {
  const [channel, setChannel] = useState<Channel>("maps");
  const [open, setOpen] = useState<string | null>(field("maps")[0]?.id ?? null);
  const cols = columns(channel);
  const rows = field(channel);
  const info = channels.find((c) => c.id === channel)!;
  const what = channel === "ai" ? "questions" : "keywords";
  const everyone = new Set(channels.flatMap((c) => field(c.id).map((s) => s.id)));
  return (
    <>
      <p className="max-w-2xl text-[13.5px] text-muted">
        You didn't have to name these. {everyone.size} businesses and sites show up for your keywords and questions:{" "}
        {channels.map((c) => `${field(c.id).length} on ${c.name}`).join(", ")}. Open one to see where they beat you.
      </p>
      <div className="mt-6">
        <Segmented<Channel>
          label="Where people searched"
          value={channel}
          onChange={(c) => {
            setChannel(c);
            setOpen(field(c)[0]?.id ?? null);
          }}
          options={channels.map((c) => ({ id: c.id, label: c.name }))}
        />
      </div>
      <Card pad={false} className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-muted">
              <th className={cn(th, "pl-4")}>Business or site</th>
              <th className={cn(th, "w-56")}>Ahead of you on</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s: Site) => {
              const n = aheadCount(channel, s);
              const isOpen = open === s.id;
              // Where they beat you first, then the rest.
              const lines = cols
                .map((c) => ({
                  c,
                  theirs: score(channel, s, c.id),
                  yours: score(channel, "you", c.id),
                }))
                .sort((a, b) => Number(ahead(channel, b.theirs, b.yours)) - Number(ahead(channel, a.theirs, a.yours)));
              return (
                <Fragment key={s.id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : s.id)}
                    className={cn("cursor-pointer hover:bg-hover", !isOpen && "border-b border-line")}
                  >
                    <td className="py-2.5 pl-4">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{s.name}</span>
                        {s.kind === "directory" && <Badge>Directory</Badge>}
                      </span>
                      <span className="block text-[12.5px] text-muted">
                        {s.biz
                          ? `${s.biz.rating.toFixed(1)} stars · ${fmt(s.biz.reviews)} reviews · ${s.biz.distanceMi} mi away`
                          : s.domain}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="num mb-1 block text-[12.5px]">
                        <b className={cn("font-medium", n ? "text-bad" : "text-good")}>{n}</b>
                        <span className="text-muted">
                          {" "}
                          of {cols.length} {what}
                        </span>
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-hover">
                        <span className="block h-full rounded-full bg-bad" style={{ width: `${(n / cols.length) * 100}%` }} />
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <button
                        aria-label={`Where ${s.name} beats you`}
                        aria-expanded={isOpen}
                        className="rounded p-1 text-subtle hover:text-fg"
                      >
                        <ChevronRight size={15} className={cn("transition-transform", isOpen && "rotate-90")} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-line">
                      <td colSpan={3} className="bg-hover/50 px-4 pt-2 pb-3">
                        <p className="py-1 text-[12.5px] text-muted">{info.unit}. Red: they beat you.</p>
                        <div className="grid gap-x-10 md:grid-cols-2">
                          {[0, 1].map((half) => (
                            <ul key={half} className="divide-y divide-line">
                              <li className="flex gap-3 pb-1 text-[12px] text-subtle">
                                <span className="flex-1">{channel === "ai" ? "Question" : "Keyword"}</span>
                                <span className="min-w-8 text-center">Them</span>
                                <span className="w-10 text-right">You</span>
                              </li>
                              {lines
                                .filter((_, i) => i < Math.ceil(lines.length / 2) === (half === 0))
                                .map((l) => (
                                  <Versus key={l.c.id} channel={channel} label={l.c.label} theirs={l.theirs} yours={l.yours} />
                                ))}
                            </ul>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {added.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="py-2.5 pl-4">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    <Badge tone="info">Added by you</Badge>
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {c.rating.toFixed(1)} stars · {fmt(c.reviews)} reviews · {c.distanceMi} mi away
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-[12.5px] text-muted">Read from the next check</td>
                <td className="py-2.5 pr-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onRemove?.(c.id)}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {channel === "google" && (
        <p className="mt-2 text-[12.5px] text-muted">
          Directories can't be beaten the way another dentist can. The move there is a complete, well-reviewed listing on them.
        </p>
      )}
      <Source>{sources.competitors}</Source>
    </>
  );
}
