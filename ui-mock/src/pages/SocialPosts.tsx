import { useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Badge, Button, Card, PageHeader, Stat, Tabs, cn, fmt } from "../components/ui";
import { ChannelBadge, PostDrawer, dayLabel } from "../components/Social";
import { channels } from "../data/social";
import { dateOf, useSocialPosts, type PostStatus, type SocialPost } from "../lib/social";

const statusTone: Record<PostStatus, "warn" | "info" | "good"> = { draft: "warn", scheduled: "info", published: "good" };

const blank = (): SocialPost => ({ id: `sp${Date.now().toString(36)}`, title: "New post", channels: ["instagram"], texts: {}, format: "Post", status: "draft", day: 1, time: "7:30 PM" });

export default function SocialPosts() {
  const posts = useSocialPosts();
  const [tab, setTab] = useState<PostStatus>("scheduled");
  const [open, setOpen] = useState<SocialPost | null>(null);
  const count = (s: PostStatus) => posts.filter((p) => p.status === s).length;
  const list = posts.filter((p) => p.status === tab).sort((a, b) => (tab === "published" ? b.day - a.day : a.day - b.day));
  const published = posts.filter((p) => p.status === "published" && p.stats && p.day >= -7);
  const views = published.reduce((a, p) => a + p.stats!.views, 0);
  const engaged = published.reduce((a, p) => a + p.stats!.likes + p.stats!.comments + p.stats!.shares, 0);
  const live = channels.filter((c) => c.connected && c.followers);
  const followers = live.reduce((a, c) => a + c.followers, 0), followersPrev = live.reduce((a, c) => a + c.followersPrev, 0);

  return (
    <>
      <PageHeader
        title="Posts & calendar"
        sub="Everything going out on your social accounts and Google profile, and how it did."
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(blank())}>New post</Button>}
      />

      <Card className="mb-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Followers" value={fmt(followers)} delta={<Badge tone="good">+{fmt(followers - followersPrev)} this month</Badge>} />
        <Stat label="Views, last 7 days" value={fmt(views)} />
        <Stat label="Likes, comments, shares" value={fmt(engaged)} />
        <Stat label="Scheduled" value={count("scheduled")} />
      </Card>

      <h2 className="mb-3 font-serif text-[22px] leading-tight">Next 7 days</h2>
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, d) => {
          const day = posts.filter((p) => p.status !== "published" && p.day === d);
          return (
            <div key={d} className={cn("min-h-28 rounded-xl border border-line bg-surface p-2.5", d === 0 && "border-ink")}>
              <div className="mb-2 flex items-baseline justify-between text-[12px]">
                <span className="font-medium">{d === 0 ? "Today" : dateOf(d).toLocaleDateString("en-US", { weekday: "short" })}</span>
                <span className="num text-subtle">{dateOf(d).getDate()}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {day.map((p) => (
                  <button key={p.id} onClick={() => setOpen(p)} className={cn("rounded-md border px-2 py-1.5 text-left text-[12px] leading-snug hover:border-line-strong", p.status === "draft" ? "border-dashed border-line-strong bg-bg" : "border-line bg-info-soft/40")}>
                    <span className="mb-1 flex items-center gap-0.5">{p.channels.map((c) => <ChannelBadge key={c} id={c} size={14} />)}<span className="ml-auto text-[11px] text-subtle">{p.time}</span></span>
                    <span className="line-clamp-2 font-medium">{p.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "scheduled", label: "Scheduled", count: count("scheduled") },
        { id: "draft", label: "Drafts", count: count("draft") },
        { id: "published", label: "Published", count: count("published") },
      ]} />
      <Card pad={false} className="mt-4">
        {list.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} className="flex w-full items-center gap-4 border-b border-line px-5 py-3.5 text-left last:border-0 hover:bg-hover/50">
            <span className="flex shrink-0 -space-x-1">{p.channels.map((c) => <ChannelBadge key={c} id={c} size={22} />)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{p.title}</span>
              <span className="block truncate text-[12.5px] text-muted">{Object.values(p.texts)[0]?.split("\n")[0] || "No text yet"}</span>
            </span>
            {p.stats ? (
              <span className="num hidden shrink-0 text-right text-[12.5px] text-muted sm:block">{fmt(p.stats.views)} views{p.stats.likes + p.stats.comments + p.stats.shares > 0 && <><br />{fmt(p.stats.likes + p.stats.comments + p.stats.shares)} reactions</>}</span>
            ) : <Badge tone={statusTone[p.status]} className="capitalize">{p.status}</Badge>}
            <span className="w-28 shrink-0 text-right text-[12.5px] text-muted">{dayLabel(p.day)}<br />{p.time}</span>
          </button>
        ))}
        {!list.length && (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            {tab === "draft" ? "No drafts. " : tab === "scheduled" ? "Nothing scheduled. " : "Nothing posted yet. "}
            <Link to="/social/trends" className="text-fg underline decoration-line-strong underline-offset-2">Remix a trending idea</Link>
          </div>
        )}
      </Card>

      <PostDrawer post={open} onClose={() => setOpen(null)} />
    </>
  );
}
