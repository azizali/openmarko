import { useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Badge, Button, Card, PageHeader, Tabs, cn, fmt } from "../components/ui";
import { ChannelBadge, PostDrawer, dayLabel } from "../components/Social";
import { channelOf, channels, type ChannelId } from "../data/social";
import { dateOf, reactions, totals, useSocialPosts, type PostStatus, type SocialPost } from "../lib/social";

const statusTone: Record<PostStatus, "warn" | "info" | "good"> = { draft: "warn", scheduled: "info", published: "good" };

const blank = (): SocialPost => ({ id: `sp${Date.now().toString(36)}`, title: "New post", channels: ["instagram"], texts: {}, format: "Post", status: "draft", day: 1, time: "7:30 PM" });

export default function SocialPosts() {
  const posts = useSocialPosts();
  const [tab, setTab] = useState<PostStatus>("scheduled");
  const [open, setOpen] = useState<SocialPost | null>(null);
  const count = (s: PostStatus) => posts.filter((p) => p.status === s).length;
  const list = posts.filter((p) => p.status === tab).sort((a, b) => (tab === "published" ? b.day - a.day : a.day - b.day));
  const published = posts.filter((p) => p.status === "published" && p.stats && p.day >= -7);
  // Every number below is broken down by the platform it came from.
  const byChannel = (pick: (s: NonNullable<NonNullable<SocialPost["stats"]>[ChannelId]>) => number) => {
    const out: Partial<Record<ChannelId, number>> = {};
    published.forEach((p) => Object.entries(p.stats!).forEach(([c, st]) => { if (st) out[c as ChannelId] = (out[c as ChannelId] ?? 0) + pick(st); }));
    return Object.entries(out).map(([c, n]) => ({ c: c as ChannelId, n: n! })).sort((a, b) => b.n - a.n);
  };
  const live = channels.filter((c) => c.connected && c.followers);
  const stats = [
    { label: "Followers", total: live.reduce((a, c) => a + c.followers, 0), note: `+${fmt(live.reduce((a, c) => a + c.followers - c.followersPrev, 0))} this month`, rows: live.map((c) => ({ c: c.id, n: c.followers })) },
    { label: "Views, last 7 days", total: published.reduce((a, p) => a + totals(p).views, 0), rows: byChannel((s) => s.views) },
    { label: "Likes, comments, shares, last 7 days", total: published.reduce((a, p) => a + reactions(totals(p)), 0), rows: byChannel(reactions) },
  ];
  const notConnected = channels.filter((c) => !c.connected);

  return (
    <>
      <PageHeader
        title="Posts & calendar"
        sub="Everything going out on your social accounts and Google profile, and how it did."
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(blank())}>New post</Button>}
      />

      <Card pad={false} className="mb-6">
        <div className="grid divide-line sm:grid-cols-3 sm:divide-x max-sm:divide-y">
          {stats.map((st) => (
            <div key={st.label} className="p-5">
              <div className="text-[12.5px] text-muted">{st.label}</div>
              <div className="mt-1 flex items-baseline gap-2"><span className="num font-serif text-[30px] leading-none tracking-tight">{fmt(st.total)}</span>{st.note && <Badge tone="good">{st.note}</Badge>}</div>
              <ul className="mt-3 mb-0 space-y-1 pl-0">
                {st.rows.map((r) => (
                  <li key={r.c} className="num flex items-center gap-2 text-[12.5px]">
                    <ChannelBadge id={r.c} size={16} /><span className="flex-1 text-muted">{channelOf(r.c).name}</span><span>{fmt(r.n)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-5 py-2.5 text-[12px] text-subtle">
          From each account's own insights: Meta for Instagram and Facebook, TikTok analytics, X analytics and Google Business Profile performance. Updated 1 hour ago.{notConnected.length > 0 && <> {notConnected.map((c) => c.name).join(", ")} isn't connected, so it's not counted. <Link to="/settings/integrations" className="underline decoration-line-strong underline-offset-2 hover:text-fg">Connect</Link></>}
        </div>
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
              <span className="num hidden shrink-0 text-right text-[12.5px] text-muted sm:block">{fmt(totals(p).views)} views{reactions(totals(p)) > 0 && <><br />{fmt(reactions(totals(p)))} reactions</>}</span>
            ) : <Badge tone={statusTone[p.status]} className="capitalize">{p.status}</Badge>}
            <span className="w-28 shrink-0 text-right text-[12.5px] text-muted">{dayLabel(p.day)}<br />{p.time}</span>
          </button>
        ))}
        {!list.length && (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            {tab === "draft" ? "No drafts. " : tab === "scheduled" ? "Nothing scheduled. " : "Nothing posted yet. "}
            <Link to="/social/scanner?tab=trending" className="text-fg underline decoration-line-strong underline-offset-2">Remix a trending idea</Link>
          </div>
        )}
      </Card>

      <PostDrawer post={open} onClose={() => setOpen(null)} />
    </>
  );
}
