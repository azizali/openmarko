// Local SEO, the small version (#/local). The overview is two columns: what we check (left) and what to do about
// it (right). Each check opens its own page (#/local/maps, /keywords, /ai, /competitors) with what is behind the
// number. Every suggestion says which check it should move and what it was based on; applying it changes the
// check. Stands on its own, outside the full app's sidebar, so the whole idea fits on one screen.

import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Plus,
  MapPin,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Button, Card, cn, Badge, Segmented, Textarea } from "../components/ui";
import { GridThumb } from "../components/GridMap";
import { LogoMark } from "../components/Logo";
import { business } from "../mock/mock";
import { AiPage, Change, CompetitorsPage, KeywordsPage } from "./LocalDetail";
import { MapsPage } from "./LocalMaps";
import { AddKeywords } from "./LocalAddKeywords";
import { CostsPage } from "./LocalCosts";
import { AddCompetitor, AddQuestions } from "./LocalAdd";
import type { Candidate } from "../mock/local";
import {
  aiNamed,
  baseKeywords,
  basePrompts,
  channels,
  engines,
  field,
  GRID_SPOTS,
  gridFor,
  kinds,
  later,
  suggestions,
  top3Spots,
  volumeOf,
  you,
  type CheckId,
  type Suggestion,
  type TrackedKeyword,
  type TrackedPrompt,
} from "../mock/local";

type Filter = "all" | Suggestion["helps"];

const checkNames: Record<CheckId, string> = {
  maps: "Google Maps ranking",
  keywords: "Keywords",
  ai: "AI answers",
  competitors: "Competitors",
};
const checkIcons: Record<CheckId, typeof MapPin> = {
  maps: MapPin,
  keywords: Search,
  ai: Sparkles,
  competitors: Users,
};
const checkIds = Object.keys(checkNames) as CheckId[];

type Row = { label: ReactNode; value: ReactNode };

export default function Local() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const page = checkIds.find((c) => c === tab) ?? null;

  // Keywords typed in by hand (Add keywords), waiting for a first result like tracked suggestions.
  const [added, setAdded] = useState<string[]>([]);
  // Questions and competitors added by hand.
  const [addedQuestions, setAddedQuestions] = useState<string[]>([]);
  const [addedRivals, setAddedRivals] = useState<Candidate[]>([]);
  const [adding, setAdding] = useState<
    "keywords" | "questions" | "competitor" | null
  >(null);
  const [done, setDone] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(suggestions[0]!.id);
  const [filter, setFilter] = useState<Filter>("all");

  const applied = suggestions.filter((s) => done.includes(s.id));
  // A keyword typed in by hand is no longer worth suggesting.
  const todo = suggestions.filter(
    (s) =>
      !done.includes(s.id) &&
      !skipped.includes(s.id) &&
      !(s.kind === "keyword" && added.includes(s.track!)) &&
      !(s.kind === "prompt" && addedQuestions.includes(s.track!)),
  );
  const shown = todo.filter((s) => filter === "all" || s.helps === filter);

  // Applying a "track" suggestion adds a row to its check, waiting for a first result.
  const keywords: TrackedKeyword[] = [
    ...baseKeywords,
    ...applied
      .filter((s) => s.kind === "keyword")
      .map((s) => ({
        id: s.id,
        term: s.track!,
        volume: s.volume ?? 0,
        google: null,
        googlePrev: null,
        pending: true,
      })),
    ...added.map((term) => ({
      id: `add_${term}`,
      term,
      volume: volumeOf(term),
      google: null,
      googlePrev: null,
      pending: true,
    })),
  ];
  const prompts: TrackedPrompt[] = [
    ...basePrompts,
    ...applied
      .filter((s) => s.kind === "prompt")
      .map((s) => ({
        id: s.id,
        text: s.track!,
        answers: basePrompts[0]!.answers,
        pending: true,
      })),
    ...addedQuestions.map((text) => ({
      id: `add_${text}`,
      text,
      answers: basePrompts[0]!.answers,
      pending: true,
    })),
  ];

  const spots = baseKeywords.reduce((n, k) => n + top3Spots(k.id), 0);
  const spotsBefore = baseKeywords.reduce(
    (n, k) => n + top3Spots(k.id, you, true),
    0,
  );
  const allSpots = GRID_SPOTS * baseKeywords.length;
  const firstPage = keywords.filter(
    (k) => k.google !== null && k.google <= 10,
  ).length;
  const firstPageBefore = baseKeywords.filter(
    (k) => k.googlePrev !== null && k.googlePrev <= 10,
  ).length;
  const ai = aiNamed(prompts);
  const everyone = new Set(
    channels.flatMap((c) => field(c.id).map((s) => s.id)),
  );

  const openCount = (id: CheckId) =>
    id === "competitors" ? 0 : todo.filter((s) => s.helps === id).length;
  const showFor = (id: Suggestion["helps"]) => {
    setFilter(id);
    navigate("/local");
  };

  // Each check: one number, then the three rows that say the most. The rest is on its page.
  const byGoogle = [...baseKeywords].sort(
    (a, b) => (a.google ?? 999) - (b.google ?? 999),
  );
  const checks: {
    id: CheckId;
    value: ReactNode;
    change?: ReactNode;
    rows: Row[];
    more: string;
    side?: ReactNode;
  }[] = [
    {
      id: "maps",
      value: (
        <>
          Top 3 in {spots}{" "}
          <span className="text-muted">of {allSpots} spots</span>
        </>
      ),
      change: <Change by={spots - spotsBefore} unit="more" />,
      rows: baseKeywords.slice(0, 3).map((k) => ({
        label: k.term,
        value: (
          <span className="flex items-center gap-2">
            {top3Spots(k.id)} of {GRID_SPOTS}
            <GridThumb scan={gridFor(k.id)} gap={4} />
          </span>
        ),
      })),
      more: `All ${baseKeywords.length} keywords, and who leads each`,
    },
    {
      id: "keywords",
      value: (
        <>
          {firstPage}{" "}
          <span className="text-muted">
            of {keywords.length} on Google's first page
          </span>
        </>
      ),
      change: <Change by={firstPage - firstPageBefore} unit="more" />,
      rows: byGoogle.slice(0, 3).map((k) => ({
        label: k.term,
        value: k.google === null ? "Not found" : `Position ${k.google}`,
      })),
      more: `All ${keywords.length} keywords, with Google's first page for each`,
    },
    {
      id: "ai",
      value: (
        <>
          Named in {ai.hits}{" "}
          <span className="text-muted">of {ai.total} answers</span>
        </>
      ),
      rows: engines.map((e) => {
        const n = aiNamed(prompts, undefined, e.id);
        return { label: e.name, value: `${n.hits} of ${n.total}` };
      }),
      more: `All ${prompts.length} questions, who gets named and the sites cited`,
    },
    {
      id: "competitors",
      value: (
        <>
          {everyone.size}{" "}
          <span className="text-muted">
            businesses and sites compete with you
          </span>
        </>
      ),
      rows: channels.map((c) => {
        const f = field(c.id);
        return {
          label: `${c.name}: ${f.length}`,
          value: `${f[0]!.name} leads`,
        };
      }),
      more: "Everyone, keyword by keyword",
    },
  ];

  return (
    <div className="min-h-full bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-3">
          <LogoMark size={22} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{business.name}</p>
            <p className="truncate text-[12.5px] text-muted">
              {business.address}
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"
          >
            <ArrowLeft size={14} />
            Full app
          </Link>
        </div>
        <nav
          aria-label="Local SEO"
          className="mx-auto mt-2 flex max-w-6xl gap-1 overflow-x-auto px-3"
        >
          {[
            { to: "/local", label: "Overview", n: 0 },
            ...checkIds.map((c) => ({
              to: `/local/${c}`,
              label: checkNames[c],
              n: openCount(c),
            })),
            { to: "/local/costs", label: "API costs", n: 0 },
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
              className={({ isActive }) =>
                cn(
                  "-mb-px shrink-0 border-b-2 px-2.5 py-2 text-[13.5px] whitespace-nowrap",
                  isActive
                    ? "border-ink font-medium text-fg"
                    : "border-transparent text-muted hover:text-fg",
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {tab === "costs" ? (
        <main className="mx-auto max-w-6xl px-5 py-8">
          <h1 className="mb-2 font-serif text-[32px] leading-[1.1] tracking-[-0.02em]">
            API costs
          </h1>
          <CostsPage />
        </main>
      ) : page ? (
        <main className="mx-auto max-w-6xl px-5 py-8">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.02em]">
              {checkNames[page]}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {(page === "maps" || page === "keywords") && (
                <Button
                  icon={<Plus size={14} />}
                  onClick={() => setAdding("keywords")}
                >
                  Add keywords
                </Button>
              )}
              {page === "ai" && (
                <Button
                  icon={<Plus size={14} />}
                  onClick={() => setAdding("questions")}
                >
                  Add questions
                </Button>
              )}
              {page === "competitors" && (
                <Button
                  icon={<Plus size={14} />}
                  onClick={() => setAdding("competitor")}
                >
                  Add competitor
                </Button>
              )}
              {page !== "competitors" && openCount(page) > 0 && (
                <Button variant="primary" onClick={() => showFor(page)}>
                  See {openCount(page)} suggestions
                </Button>
              )}
            </div>
          </div>
          {page === "maps" && (
            <MapsPage pending={keywords.filter((k) => k.pending)} />
          )}
          {page === "keywords" && <KeywordsPage keywords={keywords} />}
          {page === "ai" && <AiPage prompts={prompts} />}
          {page === "competitors" && (
            <CompetitorsPage
              added={addedRivals}
              onRemove={(id) =>
                setAddedRivals(addedRivals.filter((r) => r.id !== id))
              }
            />
          )}
          <AddQuestions
            open={adding === "questions"}
            onClose={() => setAdding(null)}
            tracked={prompts}
            onAdd={(texts) => setAddedQuestions([...addedQuestions, ...texts])}
          />
          <AddCompetitor
            open={adding === "competitor"}
            onClose={() => setAdding(null)}
            known={addedRivals.map((r) => r.name)}
            onAdd={(c) => setAddedRivals([...addedRivals, c])}
          />
          <AddKeywords
            open={adding === "keywords"}
            onClose={() => setAdding(null)}
            tracked={keywords}
            onAdd={(terms) => setAdded([...added, ...terms])}
          />
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-5 py-8">
          <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.02em]">
            Local SEO
          </h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-muted">
            We check four things every week. Each suggestion on the right comes
            from one of them, and says what it was based on.
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <section aria-labelledby="stand">
              <h2 id="stand" className="text-[15px] font-medium">
                Where you stand
              </h2>
              <p className="mb-3 text-[13px] text-muted">
                Checked Monday. Open one for every keyword and competitor behind
                it.
              </p>
              <div className="space-y-3">
                {checks.map((c) => {
                  const Icon = checkIcons[c.id];
                  const n = openCount(c.id);
                  return (
                    <Link
                      key={c.id}
                      to={`/local/${c.id}`}
                      className="group block rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong"
                    >
                      <p className="flex items-center gap-1.5 text-[13px] text-muted">
                        <Icon size={14} />
                        {checkNames[c.id]}
                        {n > 0 && (
                          <Badge tone="accent" className="ml-1">
                            {n} to do
                          </Badge>
                        )}
                      </p>
                      <p className="num mt-1.5 text-[20px] leading-tight font-medium">
                        {c.value}
                      </p>
                      {c.change && <p className="mt-1">{c.change}</p>}
                      <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                        {c.rows.map((r, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-3 text-[13px]"
                          >
                            <span className="min-w-0 truncate text-muted">
                              {r.label}
                            </span>
                            <span className="num shrink-0">{r.value}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 flex items-center gap-1 text-[13px] text-muted group-hover:text-fg">
                        {c.more}
                        <ChevronRight size={14} />
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="next">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="next" className="text-[15px] font-medium">
                    What to do next
                  </h2>
                  <p className="text-[13px] text-muted">
                    {todo.length} suggestions, most useful first. Nothing
                    changes until you press the button.
                  </p>
                </div>
                <Segmented<Filter>
                  label="Show suggestions for"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { id: "all", label: "All" },
                    { id: "maps", label: "Maps" },
                    { id: "keywords", label: "Keywords" },
                    { id: "ai", label: "AI" },
                  ]}
                />
              </div>

              <div className="space-y-3">
                {shown.map((s) => {
                  const k = kinds[s.kind];
                  const isOpen = open === s.id;
                  return (
                    <Card key={s.id} pad={false}>
                      <button
                        onClick={() => setOpen(isOpen ? null : s.id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-start gap-3 p-4 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] text-muted">
                            {k.label} · helps {checkNames[s.helps]}
                          </p>
                          <p className="mt-0.5 text-[15px] font-medium">
                            {s.title}
                          </p>
                          <p className="mt-1 text-[13.5px] text-muted">
                            {s.why}
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className={cn(
                            "mt-1 shrink-0 text-subtle transition-transform",
                            isOpen && "rotate-90",
                          )}
                        />
                      </button>

                      {isOpen && (
                        <div className="anim-fade border-t border-line px-4 pt-4 pb-4">
                          <p className="text-[12.5px] font-medium">Based on</p>
                          <ul className="mt-1.5 space-y-1 text-[13.5px] text-muted">
                            {s.evidence.map((e) => (
                              <li key={e} className="flex gap-2">
                                <span className="mt-[9px] size-1 shrink-0 rounded-full bg-subtle" />
                                {e}
                              </li>
                            ))}
                          </ul>

                          {s.change && (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <div className="rounded-lg border border-line p-3">
                                <p className="text-[12.5px] text-muted">
                                  {s.change.field} now
                                </p>
                                <p className="mt-1 text-[13.5px]">
                                  {s.change.before}
                                </p>
                              </div>
                              <div className="rounded-lg border border-good/40 bg-good-soft p-3">
                                <p className="text-[12.5px] text-good">
                                  {s.change.field} after
                                </p>
                                <p className="mt-1 text-[13.5px]">
                                  {s.change.after}
                                </p>
                              </div>
                            </div>
                          )}
                          {s.draft && (
                            <label className="mt-4 block">
                              <span className="text-[12.5px] font-medium">
                                The post (edit it if you like)
                              </span>
                              <Textarea
                                className="mt-1.5 w-full"
                                rows={4}
                                value={drafts[s.id] ?? s.draft}
                                onChange={(e) =>
                                  setDrafts({
                                    ...drafts,
                                    [s.id]: e.target.value,
                                  })
                                }
                              />
                            </label>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                              variant="primary"
                              onClick={() => setDone([...done, s.id])}
                            >
                              {k.action}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setSkipped([...skipped, s.id])}
                            >
                              Not now
                            </Button>
                          </div>
                          <p className="mt-3 text-[12.5px] text-muted">
                            {k.source}
                          </p>
                        </div>
                      )}
                    </Card>
                  );
                })}
                {shown.length === 0 && (
                  <Card className="text-center">
                    <p className="text-[14px] font-medium">Nothing left here</p>
                    <p className="mt-1 text-[13px] text-muted">
                      New suggestions come after Monday's check.{" "}
                      {filter !== "all" && (
                        <button
                          onClick={() => setFilter("all")}
                          className="text-fg underline underline-offset-2"
                        >
                          Show all
                        </button>
                      )}
                    </p>
                  </Card>
                )}
              </div>

              {applied.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 text-[13px] font-medium text-muted">
                    Done ({applied.length})
                  </h3>
                  <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                    {applied.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-start gap-3 px-4 py-3"
                      >
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-good-soft text-good">
                          <Check size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px]">{s.title}</p>
                          <p className="text-[12.5px] text-muted">
                            {kinds[s.kind].done}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDone(done.filter((id) => id !== s.id))
                          }
                        >
                          Undo
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-8 rounded-xl border border-dashed border-line-strong p-4">
                <p className="text-[13px] font-medium">Not on this page yet</p>
                <ul className="mt-1.5 space-y-0.5 text-[13px] text-muted">
                  {later.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
