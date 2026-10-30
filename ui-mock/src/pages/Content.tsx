import { useState } from "react";
import { Link } from "react-router";
import { Loader2, Newspaper, Sparkles, Store, X } from "lucide-react";
import { Badge, Button, Card, PageHeader, Segmented, Stat, cn, fmt, useToast } from "../components/ui";
import { keywords, type ContentStatus } from "../data/mock";
import { advanceContent, removeContent, suggestIdeas, useContent, type ContentType, type PlanItem } from "../lib/content";

const columns: { id: ContentStatus; label: string; sub: string }[] = [
  { id: "idea", label: "Ideas", sub: "Suggested from your keywords" },
  { id: "draft", label: "Drafts", sub: "Written, waiting for you" },
  { id: "scheduled", label: "Scheduled", sub: "Going out automatically" },
  { id: "published", label: "Published", sub: "Live, with results" },
];
const dot: Record<ContentStatus, string> = { idea: "bg-subtle", draft: "bg-warn", scheduled: "bg-info", published: "bg-good" };
const action: Partial<Record<ContentStatus, string>> = { idea: "Write draft", draft: "Publish", scheduled: "Publish now" };

export default function Content() {
  const items = useContent();
  const [type, setType] = useState<"all" | ContentType>("all");
  const [kw, setKw] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const { toast, node } = useToast();

  const shown = items.filter((i) => (type === "all" || i.type === type) && (kw === "all" || i.keywordId === kw));
  const count = (s: ContentStatus) => items.filter((i) => i.status === s).length;
  const clicks = items.filter((i) => i.type === "article" && i.metric).reduce((n, i) => n + parseInt(i.metric!.replace(/\D/g, "")), 0);
  const views = items.filter((i) => i.type === "post" && i.metric).reduce((n, i) => n + parseInt(i.metric!.replace(/\D/g, "")), 0);
  const uncovered = keywords.filter((k) => !items.some((i) => i.keywordId === k.id));

  const advance = (i: PlanItem) => {
    setBusy(i.id);
    setTimeout(() => {
      advanceContent(i.id);
      setBusy(null);
      toast(i.status === "idea" ? (i.type === "article" ? "Draft written. Review it in WordPress" : "Post drafted") : i.type === "article" ? "Published to your website" : "Posted to Google Business Profile");
    }, 900);
  };
  const suggest = () => {
    setSuggesting(true);
    setTimeout(() => {
      const n = suggestIdeas(3, kw === "all" ? undefined : kw);
      setSuggesting(false);
      toast(n ? `${n} new idea${n === 1 ? "" : "s"} added` : "No new ideas for this keyword");
    }, 800);
  };

  return (
    <>
      <PageHeader
        title="Content"
        sub="Every article on your website and post on your Google profile, from idea to published, each aimed at a keyword you track."
        actions={<Button variant="primary" icon={suggesting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} disabled={suggesting} onClick={suggest}>Suggest ideas</Button>}
      />

      <Card className="mb-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Published" value={count("published")} />
        <Stat label="Scheduled & drafts" value={count("scheduled") + count("draft")} />
        <Stat label="Clicks from articles" value={fmt(clicks)} />
        <Stat label="Profile post views" value={fmt(views)} />
      </Card>

      {uncovered.length > 0 && (
        <p className="mb-4 text-[13px] text-muted">
          <b className="font-medium text-fg">{uncovered.length} tracked keyword{uncovered.length === 1 ? " has" : "s have"} no content yet:</b>{" "}
          {uncovered.slice(0, 4).map((k) => k.term).join(", ")}{uncovered.length > 4 && ` and ${uncovered.length - 4} more`}. Suggest ideas picks these first.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented label="Type" value={type} onChange={setType} options={[{ id: "all", label: "All" }, { id: "article", label: "Articles" }, { id: "post", label: "Profile posts" }]} />
        <select aria-label="Keyword" value={kw} onChange={(e) => setKw(e.target.value)} className="h-8 max-w-60 rounded-md border border-line bg-surface px-2 text-[13px] outline-none">
          <option value="all">All keywords</option>
          {keywords.map((k) => <option key={k.id} value={k.id}>{k.term}</option>)}
        </select>
        <span className="num ml-auto text-[12.5px] text-subtle">{shown.length} of {items.length} pieces</span>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((c) => {
          const col = shown.filter((i) => i.status === c.id);
          return (
            <section key={c.id} className="rounded-xl bg-hover/60 p-2">
              <header className="flex items-center gap-2 px-2 pt-1 pb-2.5" title={c.sub}>
                <span className={cn("size-2 rounded-full", dot[c.id])} aria-hidden />
                <h2 className="text-[13.5px] font-medium">{c.label}</h2>
                <span className="num text-[12px] text-muted">{col.length}</span>
              </header>
              <div className="space-y-2">
                {col.map((i) => <ContentCard key={i.id} item={i} busy={busy === i.id} onAdvance={() => advance(i)} onRemove={() => removeContent(i.id)} />)}
                {!col.length && <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-muted">Nothing here</div>}
                {c.id === "idea" && (
                  <button onClick={suggest} disabled={suggesting} className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] text-muted hover:bg-surface hover:text-fg disabled:opacity-50">
                    <Sparkles size={12} /> Suggest more
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <Link to="/profile" className="mt-4 inline-flex text-[12.5px] text-muted hover:text-fg">Write a one-off Business Profile post →</Link>
      {node}
    </>
  );
}

function ContentCard({ item, busy, onAdvance, onRemove }: { item: PlanItem; busy: boolean; onAdvance: () => void; onRemove: () => void }) {
  const kw = keywords.find((k) => k.id === item.keywordId);
  const act = action[item.status];
  return (
    <article className={cn("rounded-lg border bg-surface p-3 shadow-card", item.isNew ? "border-accent/40" : "border-line")}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-subtle" title={item.type === "article" ? "Website article" : "Business Profile post"}>
          {item.type === "article" ? <Newspaper size={14} /> : <Store size={14} />}
        </span>
        <div className="min-w-0 flex-1 text-[13.5px] leading-snug font-medium">{item.title}</div>
        {item.status === "idea" && <button onClick={onRemove} aria-label="Dismiss idea" className="rounded p-0.5 text-subtle hover:bg-hover hover:text-fg"><X size={13} /></button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-[22px] text-[12px] text-muted">
        {item.isNew && <Badge tone="accent">New</Badge>}
        {kw && <span className="text-subtle">#{kw.term}</span>}
        <span>· {item.date}</span>
        {item.words && <span className="num">· {fmt(item.words)} words</span>}
      </div>
      {item.why && <div className="mt-1 pl-[22px] text-[12px] text-subtle">{item.why}</div>}
      {(item.metric || act) && (
        <div className="mt-2.5 flex items-center gap-2 pl-[22px]">
          {item.metric && <span className="num text-[12.5px] font-medium text-good">{item.metric}</span>}
          {act && <Button size="sm" className="ml-auto" onClick={onAdvance} disabled={busy} icon={busy ? <Loader2 size={12} className="animate-spin" /> : item.status === "idea" ? <Sparkles size={12} /> : undefined}>{act}</Button>}
        </div>
      )}
    </article>
  );
}
