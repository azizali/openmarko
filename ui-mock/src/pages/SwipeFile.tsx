import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Card, Drawer, PageHeader, Segmented, cn } from "../components/ui";
import { PlatformMark, PostDrawer } from "../components/Social";
import { platformMeta, type SocialPlatform, type Trend } from "../data/social";
import { asTrend, blankSwipe, markUsed, removeSwipe, saveSwipe, useSwipes, type Swipe, type SwipeKind } from "../lib/swipes";

const sources = [
  { id: "all", label: "All" },
  { id: "trend", label: "Saved from trends" },
  { id: "mine", label: "Mine" },
  { id: "starter", label: "Starters" },
] as const;
const sourceLabel: Record<Swipe["source"], string> = { trend: "Saved from a trend", mine: "Yours", starter: "Starter" };

// Formats and ideas worth reusing. Save them from trends, write your own, and
// turn any of them into a post in your brand voice.
export default function SwipeFile() {
  const items = useSwipes();
  const [source, setSource] = useState<(typeof sources)[number]["id"]>("all");
  const [post, setPost] = useState<Trend | null>(null);
  const [edit, setEdit] = useState<Swipe | null>(null);
  const shown = items.filter((s) => source === "all" || s.source === source);

  return (
    <>
      <PageHeader
        title="Swipe file"
        sub={<>Formats and ideas worth reusing: ones you saved from <Link to="/social/scanner?tab=trending" className="underline decoration-line-strong underline-offset-2 hover:text-fg">trends</Link>, ones you wrote, and a few to start with. Turn any of them into a post in your voice.</>}
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setEdit(blankSwipe())}>New idea</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button key={s.id} onClick={() => setSource(s.id)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors", source === s.id ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>
            {s.label} <span className="num opacity-70">{items.filter((x) => s.id === "all" || x.source === s.id).length}</span>
          </button>
        ))}
      </div>

      <Card pad={false}>
        {shown.map((s) => (
          <article key={s.id} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 md:flex-row md:items-start md:gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                <Badge tone={s.source === "trend" ? "accent" : "neutral"}>{s.kind}</Badge>
                <span>{sourceLabel[s.source]}</span>
                <span className="text-subtle">· {s.used ? `Used ${s.used}×` : "Not used yet"}</span>
              </div>
              <h2 className="mt-1.5 mb-0 text-[15.5px] leading-snug font-medium">{s.title}</h2>
              <p className="mt-1 mb-0 text-[13.5px] leading-[1.55] text-muted">{s.why}</p>
              <ol className="mt-2 mb-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-1 pl-0 text-[13px]">
                {s.structure.filter(Boolean).map((b, i) => (
                  <li key={b} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-subtle" aria-hidden>→</span>}
                    <span className="num text-[11px] text-subtle">{i + 1}</span><span>{b}</span>
                  </li>
                ))}
              </ol>
              {s.example && <p className="mt-2 mb-0 text-[13.5px] leading-[1.55]"><span className="font-medium">Yours: </span>{s.example}</p>}
              <div className="mt-2 flex items-center gap-1">{s.platforms.map((c) => <PlatformMark key={c} platform={c} size={16} />)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-end">
              <Button size="sm" variant="primary" icon={<Wand2 size={12} />} onClick={() => { markUsed(s.id); setPost(asTrend(s)); }}>Create post</Button>
              {s.source !== "starter" && <Button size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={() => setEdit(s)}>Edit</Button>}
            </div>
          </article>
        ))}
        {!shown.length && <div className="px-5 py-10 text-center text-[13.5px] text-muted">Nothing here yet. Save a trend from <Link to="/social/scanner?tab=trending" className="text-fg underline decoration-line-strong underline-offset-2">Social scanner → Trending</Link>, or add your own.</div>}
      </Card>

      <PostDrawer trend={post} onClose={() => setPost(null)} />
      <SwipeEditor swipe={edit} onClose={() => setEdit(null)} />
    </>
  );
}

const kinds: { id: SwipeKind; label: string }[] = [{ id: "Format", label: "Format" }, { id: "Hook", label: "Hook" }, { id: "Idea", label: "Idea" }, { id: "Series", label: "Series" }];

function SwipeEditor({ swipe, onClose }: { swipe: Swipe | null; onClose: () => void }) {
  const [s, setS] = useState<Swipe | null>(swipe);
  const saved = useSwipes();
  useEffect(() => { setS(swipe); }, [swipe?.id]);
  if (!swipe || !s) return null;
  const isNew = !saved.some((x) => x.id === swipe.id);
  const field = "w-full rounded-lg border border-line bg-surface p-3 text-[13.5px] leading-[1.55] outline-none focus:border-line-strong";
  const toggleCh = (c: SocialPlatform) => setS({ ...s, platforms: s.platforms.includes(c) ? s.platforms.filter((x) => x !== c) : [...s.platforms, c] });

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={isNew ? "New idea" : s.title}
      footer={<>
        {!isNew && <Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => { removeSwipe(s.id); onClose(); }}>Delete</Button>}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!s.title.trim()} onClick={() => { saveSwipe({ ...s, structure: s.structure.map((b) => b.trim()).filter(Boolean) }); onClose(); }}>Save</Button>
      </>}
    >
      <div className="flex flex-col gap-5">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Name</span>
          <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="e.g. Patient question of the week" className={cn(field, "h-10 py-0")} />
        </label>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Kind</span>
          <Segmented label="Kind" value={s.kind} onChange={(k) => setS({ ...s, kind: k })} options={kinds} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Why it works</span>
          <textarea value={s.why} onChange={(e) => setS({ ...s, why: e.target.value })} rows={2} placeholder="What makes people stop, save or share it" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">The beats, one per line</span>
          <textarea value={s.structure.join("\n")} onChange={(e) => setS({ ...s, structure: e.target.value.split("\n") })} rows={5} placeholder={"Hook\nThe tip\nWhy it matters\nAsk a question"} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Your version (optional)</span>
          <textarea value={s.example} onChange={(e) => setS({ ...s, example: e.target.value })} rows={3} placeholder="A line or two of how it sounds for you" className={field} />
        </label>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Best on</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(platformMeta) as SocialPlatform[]).map((p) => (
              <button key={p} onClick={() => toggleCh(p)} aria-pressed={s.platforms.includes(p)} className={cn("inline-flex h-8 items-center gap-2 rounded-full border pr-3 pl-1.5 text-[13px] transition-colors", s.platforms.includes(p) ? "border-ink bg-active" : "border-line text-muted hover:bg-hover")}>
                <PlatformMark platform={p} size={20} /> {platformMeta[p].name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
