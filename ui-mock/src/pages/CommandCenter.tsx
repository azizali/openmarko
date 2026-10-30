import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Wrench, Loader2, Undo2, ArrowRight, X, Search, Sparkles, Plus, Newspaper, Store, Crosshair } from "lucide-react";
import { Badge, Button, Card, ScoreRing, Segmented, cn, fmt, useToast } from "../components/ui";
import { CommandTop, topVariants, type TopVariant } from "../components/CommandTop";
import { KeywordTable } from "../components/KeywordTable";
import { TaskDrawer, UpNext } from "../components/Todo";
import {
  auditIssues, auditKeywordLinks, auditSummary, blogPosts, gbpPosts, keywords,
  type ContentItem, type ContentStatus, type Keyword,
} from "../data/mock";
import { openTasksFor, runTasks, undoTask, useRunState, type Task } from "../lib/tasks";

// ---------- Page ----------

export default function CommandCenter() {
  const state = useRunState();
  const [focus, setFocus] = useState<string | null>(null);
  const focusKw = keywords.find((k) => k.id === focus) ?? null;
  const [open, setOpen] = useState<Task | null>(null);
  const { toast, node } = useToast();
  // Two layouts for the top area; the choice is remembered per browser.
  const [top, setTopState] = useState<TopVariant>(() => {
    try { const v = localStorage.getItem("gw-cc-top"); return topVariants.some((t) => t.id === v) ? (v as TopVariant) : "story"; } catch { return "story"; }
  });
  const setTop = (v: TopVariant) => { setTopState(v); try { localStorage.setItem("gw-cc-top", v); } catch {} };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[40px] leading-[1.1] tracking-[-0.02em]">Command <span className="ink-sheen">Center</span></h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-muted">Everything about how Maple & Main Dental shows up on Google, on one page.</p>
        </div>
        <div className="flex max-w-full items-center gap-2 overflow-x-auto print:hidden">
          <span className="shrink-0 text-[12px] text-subtle">Layout</span>
          <span className="shrink-0"><Segmented label="Top area layout" value={top} onChange={setTop} options={topVariants} /></span>
        </div>
      </div>

      <CommandTop variant={top} state={state} />

      {focusKw && (
        <div className="anim-fade sticky top-12 z-10 mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface/95 px-4 py-2.5 shadow-sm backdrop-blur lg:top-3">
          <Crosshair size={15} className="text-accent" />
          <span className="text-[13.5px]">Focused on <b className="font-medium">{focusKw.term}</b></span>
          <span className="text-[12.5px] text-muted">Up next, site fixes and content show only what affects this keyword.</span>
          <button onClick={() => setFocus(null)} className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-[12.5px] text-muted hover:bg-hover hover:text-fg"><X size={13} /> Clear</button>
        </div>
      )}

      <UpNext focus={focusKw} onOpen={setOpen} />

      <KeywordsSection focus={focus} onFocus={(id) => setFocus((f) => (f === id ? null : id))} onOpenTask={(kid) => setOpen(openTasksFor(state, kid)[0] ?? null)} />

      <HealthSection focus={focusKw} state={state} onRun={(id) => runTasks([id])} onUndo={undoTask} />

      <ContentPanel focus={focusKw} onFocus={(id) => setFocus(id)} toast={toast} />

      <TaskDrawer task={open} onClose={() => setOpen(null)} />
      {node}
    </>
  );
}

function KeywordsSection({ focus, onFocus, onOpenTask }: { focus: string | null; onFocus: (id: string) => void; onOpenTask: (kwId: string) => void }) {
  const [q, setQ] = useState("");
  const rows = keywords.filter((k) => !q || k.term.includes(q.toLowerCase()));
  return (
    <section className="mt-10">
      <SectionTitle
        id="keywords"
        title="Keywords & map pack"
        sub="Where you rank on Google and in the map for every keyword. Open a row for the map, every competitor beside you, and history."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5">
              <Search size={13} className="text-subtle" />
              <input aria-label="Search keywords" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-28 bg-transparent text-[13px] outline-none" />
            </div>
            <Link to="/rankings" className="text-[13px] text-muted hover:text-fg">Filters & history →</Link>
          </div>
        }
      />
      <KeywordTable rows={rows} expanded={focus} onToggle={onFocus} onOpenTask={onOpenTask} />
    </section>
  );
}

function SectionTitle({ id, title, sub, right }: { id: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div id={id} className="mb-3 flex scroll-mt-20 flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-serif text-[22px] leading-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}


// ---------- Site health ----------

const sevTone = { critical: "bad", warning: "warn", notice: "info" } as const;
const sevRank = { critical: 0, warning: 1, notice: 2 } as const;
const auditCats = ["All", "Technical", "On-page", "Local", "Performance", "Content"] as const;

function HealthSection({ focus, state, onRun, onUndo }: { focus: Keyword | null; state: Record<string, string>; onRun: (id: string) => void; onUndo: (id: string) => void }) {
  const [cat, setCat] = useState<(typeof auditCats)[number]>("All");
  const [showAll, setShowAll] = useState(false);
  const issues = auditIssues
    .filter((i) => (!focus || (auditKeywordLinks[i.id] ?? []).includes(focus.id)) && (cat === "All" || i.category === cat))
    .sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  const visible = showAll ? issues : issues.slice(0, 6);
  const fixed = auditIssues.filter((i) => state[i.id] === "done").length;
  const count = (s: keyof typeof sevRank) => auditIssues.filter((i) => i.severity === s && state[i.id] !== "done").length;
  const vitals = [
    { label: "Loading (LCP)", value: `${auditSummary.lcp}s`, ok: auditSummary.lcp <= 2.5, target: "≤ 2.5s" },
    { label: "Responsiveness (INP)", value: `${auditSummary.inp}ms`, ok: auditSummary.inp <= 200, target: "≤ 200ms" },
    { label: "Visual stability (CLS)", value: auditSummary.cls.toFixed(2), ok: auditSummary.cls <= 0.1, target: "≤ 0.1" },
  ];

  return (
    <section className="mt-10">
      <SectionTitle
        id="health"
        title="Site health"
        sub={`mapleandmaindental.com · ${auditSummary.pages} pages checked ${auditSummary.crawled.split(" ")[0]}`}
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            {auditCats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("h-7 rounded-full border px-2.5 text-[12.5px] transition-colors", cat === c ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>{c}</button>
            ))}
            <Link to="/audit" className="ml-1 text-[13px] text-muted hover:text-fg">Full audit →</Link>
          </div>
        }
      />
      <Card pad={false}>
        <div className="grid gap-px border-b border-line bg-line sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex items-center gap-5 bg-surface p-5">
            <ScoreRing score={Math.min(100, auditSummary.score + fixed * 3)} size={72} stroke={6} label="Site health" />
            <div className="text-[13px]">
              <div className="text-[14px] font-medium">{auditSummary.score >= 80 ? "Your site is healthy" : "A few fixes will help"}</div>
              <div className="text-muted">Up {auditSummary.score - auditSummary.prevScore} points since last week{fixed ? ` · ${fixed} fixed today` : ""}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="bad">{count("critical")} critical</Badge>
                <Badge tone="warn">{count("warning")} warnings</Badge>
                <Badge tone="info">{count("notice")} notices</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 bg-surface p-5">
            {vitals.map((v) => (
              <div key={v.label}>
                <div className="text-[12px] text-muted">{v.label}</div>
                <div className={cn("num mt-1 font-serif text-[22px] leading-none", v.ok ? "text-good" : "text-warn")}>{v.value} <span className="font-sans text-[12px] font-medium">{v.ok ? "Good" : "Slow"}</span></div>
                <div className="mt-1 text-[11.5px] text-subtle">Target {v.target} on phones</div>
              </div>
            ))}
          </div>
        </div>
        {visible.map((i) => {
          const st = state[i.id];
          return (
            <div key={i.id} className={cn("flex items-center gap-4 border-b border-line px-5 py-3 last:border-0", st === "done" && "bg-good-soft/30")}>
              <Badge tone={sevTone[i.severity]} className="w-[68px] shrink-0 justify-center capitalize">{i.severity}</Badge>
              <Link to={`/audit/${i.id}`} className="min-w-0 flex-1">
                <div className={cn("truncate text-[13.5px] font-medium hover:underline", st === "done" && "text-muted line-through decoration-1")}>{i.title}</div>
                <div className="truncate text-[12.5px] text-muted">{i.fix}</div>
                <div className="truncate text-[11.5px] text-subtle">{i.category} · {i.pages.join(", ")}</div>
              </Link>
              {i.autoFix && <span className="hidden text-[12px] text-subtle md:block">via {i.autoFix.executor}</span>}
              <div className="shrink-0">
                {st === "done" ? (
                  <button onClick={() => onUndo(i.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12.5px] text-muted hover:bg-hover"><Undo2 size={12} /> Undo</button>
                ) : st === "running" ? (
                  <Button size="sm" disabled><Loader2 size={13} className="animate-spin" /></Button>
                ) : i.autoFix ? (
                  <Button size="sm" icon={<Wrench size={12} />} onClick={() => onRun(i.id)}>Fix</Button>
                ) : (
                  <Link to={`/audit/${i.id}`}><Button size="sm" variant="ghost">How to fix</Button></Link>
                )}
              </div>
            </div>
          );
        })}
        {!visible.length && <div className="px-5 py-10 text-center text-[13px] text-muted">No site issues affect this keyword.</div>}
        {issues.length > 6 && (
          <button onClick={() => setShowAll(!showAll)} className="w-full border-t border-line px-4 py-2.5 text-[13px] text-muted hover:bg-hover hover:text-fg">
            {showAll ? "Show fewer" : `Show ${issues.length - 6} more`}
          </button>
        )}
      </Card>
    </section>
  );
}

// ---------- Content ----------

const statusTone: Record<ContentStatus, "neutral" | "info" | "warn" | "good"> = { idea: "neutral", draft: "warn", scheduled: "info", published: "good" };

function ContentPanel({ focus, onFocus, toast }: { focus: Keyword | null; onFocus: (id: string) => void; toast: (m: string) => void }) {
  const [blogs, setBlogs] = useState(blogPosts);
  const [posts, setPosts] = useState(gbpPosts);
  const [busy, setBusy] = useState<string | null>(null);

  const advance = (list: "blog" | "post", item: ContentItem) => {
    setBusy(item.id);
    setTimeout(() => {
      const next: ContentStatus = item.status === "idea" ? "draft" : "published";
      const upd = (xs: ContentItem[]) => xs.map((x) => (x.id === item.id ? { ...x, status: next, date: next === "draft" ? "Just now" : "Today" } : x));
      list === "blog" ? setBlogs(upd) : setPosts(upd);
      setBusy(null);
      toast(next === "draft" ? "Draft written. Review it in WordPress" : "Published");
    }, 900);
  };
  const add = (list: "blog" | "post") => {
    const kw = focus ?? keywords[2];
    const item: ContentItem = list === "blog"
      ? { id: `b${Date.now()}`, title: `${kw.term.replace(/\b\w/g, (c) => c.toUpperCase())}: what to know`, status: "idea", keywordId: kw.id, date: "Suggested", words: 1200 }
      : { id: `p${Date.now()}`, title: `Update about ${kw.term.replace(" austin", "")}`, status: "draft", keywordId: kw.id, date: "Ready to publish" };
    list === "blog" ? setBlogs((b) => [item, ...b]) : setPosts((p) => [item, ...p]);
  };

  const List = ({ list, items }: { list: "blog" | "post"; items: ContentItem[] }) => {
    const shown = items.filter((i) => !focus || i.keywordId === focus.id);
    return (
      <>
        {shown.map((i) => {
          const kw = keywords.find((k) => k.id === i.keywordId);
          const act = i.status === "idea" ? "Write" : i.status === "draft" ? "Publish" : null;
          return (
            <div key={i.id} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] leading-snug font-medium">{i.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  <Badge tone={statusTone[i.status]} className="capitalize">{i.status}</Badge>
                  {kw && <button onClick={() => onFocus(kw.id)} className="text-subtle hover:text-fg">#{kw.term}</button>}
                  <span>· {i.date}</span>
                  {i.words && <span className="num">· {fmt(i.words)} words</span>}
                  {i.metric && <span className="num">· {i.metric}</span>}
                </div>
              </div>
              {act && (
                <Button size="sm" onClick={() => advance(list, i)} disabled={busy === i.id} icon={busy === i.id ? <Loader2 size={12} className="animate-spin" /> : act === "Write" ? <Sparkles size={12} /> : undefined}>{act}</Button>
              )}
            </div>
          );
        })}
        {!shown.length && <div className="px-4 py-8 text-center text-[13px] text-muted">Nothing for this keyword yet.</div>}
      </>
    );
  };

  return (
    <section className="mt-10">
      <SectionTitle id="content" title="Content" sub="Articles on your website and posts on your Google profile, each aimed at a keyword." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card pad={false}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 text-[14px] font-medium"><Newspaper size={15} /> Blog articles</span>
            <Button size="sm" variant="ghost" icon={<Sparkles size={12} />} onClick={() => add("blog")}>Suggest</Button>
          </div>
          <List list="blog" items={blogs} />
        </Card>
        <Card pad={false}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 text-[14px] font-medium"><Store size={15} /> Business Profile posts</span>
            <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => add("post")}>New post</Button>
          </div>
          <List list="post" items={posts} />
        </Card>
      </div>
      <Link to="/profile" className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-fg">Reviews, posts and profile settings <ArrowRight size={12} /></Link>
    </section>
  );
}
