import { useState } from "react";
import { Link } from "react-router";
import { Flame, Wand2 } from "lucide-react";
import { Badge, Button, Card, PageHeader, cn } from "../components/ui";
import { ChannelBadge, PostDrawer } from "../components/Social";
import { trends, type Trend, type TrendKind } from "../data/social";
import { voice } from "../data/brand";
import { useSocialPosts } from "../lib/social";

const kinds: ("All" | TrendKind)[] = ["All", "Format", "Topic", "Local", "Seasonal"];

// What's working right now in this niche and city, and how to make it yours.
export default function SocialTrends() {
  const [kind, setKind] = useState<(typeof kinds)[number]>("All");
  const [open, setOpen] = useState<Trend | null>(null);
  const posts = useSocialPosts();
  const shown = trends.filter((t) => kind === "All" || t.kind === kind).sort((a, b) => b.fit - a.fit);
  const usedBy = (t: Trend) => posts.find((p) => p.trendId === t.id);

  return (
    <>
      <PageHeader
        title="Trending ideas"
        sub="What's catching on with dentists and in Austin this week, why it works, and a version written in your voice. Refreshed every morning."
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4 !py-4">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Wand2 size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">Written in your voice</div>
          <div className="line-clamp-2 text-[13px] text-muted">{voice.summary}</div>
        </div>
        <Link to="/brand"><Button size="sm" variant="ghost">Edit voice</Button></Link>
      </Card>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn("h-7 rounded-full border px-2.5 text-[12.5px] transition-colors", kind === k ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>{k}</button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((t) => {
          const used = usedBy(t);
          return (
            <Card key={t.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                <Badge>{t.kind}</Badge>
                <span className="inline-flex items-center gap-1 font-medium text-accent"><Flame size={12} /> {t.velocity}</span>
                <span className="ml-auto num">Fit {t.fit}</span>
              </div>
              <div>
                <h2 className="font-serif text-[20px] leading-snug">{t.title}</h2>
                <div className="mt-0.5 text-[12.5px] text-subtle">{t.source}</div>
              </div>
              <p className="m-0 text-[13.5px] leading-[1.55]"><span className="font-medium">Why it works: </span><span className="text-muted">{t.insight}</span></p>
              <p className="m-0 rounded-lg bg-hover px-3 py-2.5 text-[13.5px] leading-[1.55]"><span className="font-medium">Your version: </span>{t.angle}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <span className="flex items-center gap-1">{t.bestFor.map((c) => <ChannelBadge key={c} id={c} size={18} />)}</span>
                <span className="text-[12px] text-subtle">{t.remix.format}</span>
                <span className="flex-1" />
                {used && <Link to="/social/posts" className="text-[12.5px] text-muted hover:text-fg">{used.status === "published" ? "Posted" : used.status === "scheduled" ? "Scheduled" : "In drafts"} →</Link>}
                <Button size="sm" variant={used ? "secondary" : "primary"} icon={<Wand2 size={12} />} onClick={() => setOpen(t)}>{used ? "Remix again" : "Remix in my voice"}</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <PostDrawer trend={open} onClose={() => setOpen(null)} />
    </>
  );
}
