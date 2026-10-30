import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Clapperboard, Send, Trash2 } from "lucide-react";
import { Badge, Button, Drawer, cn, useToast } from "./ui";
import { PostPreview } from "./PostPreview";
import { bestTime, channelOf, channels, draftFor, type ChannelId, type ToneTweak, type Trend } from "../data/social";
import { dateOf, publishNow, reactions, remixTrend, removePost, savePost, schedulePost, unschedulePost, type SocialPost } from "../lib/social";

export function ChannelBadge({ id, size = 20 }: { id: ChannelId; size?: number }) {
  const c = channelOf(id);
  return (
    <span title={c.name} className="grid shrink-0 place-items-center rounded-md font-semibold text-white" style={{ width: size, height: size, background: c.color, fontSize: size * 0.45 }}>
      {c.short}
    </span>
  );
}

export const dayLabel = (day: number) =>
  day === 0 ? "Today" : day === 1 ? "Tomorrow" : day === -1 ? "Yesterday" : day < 0 ? `${-day} days ago` : dateOf(day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const tweakLabels: { id: ToneTweak; label: string }[] = [
  { id: "shorter", label: "Shorter" },
  { id: "playful", label: "More playful" },
  { id: "expert", label: "More expert" },
];

/**
 * Writes or edits one post. From a trend it drafts a version per channel in the
 * brand voice; from an existing post it edits that post's texts.
 */
export function PostDrawer({ trend, post, onClose }: { trend?: Trend | null; post?: SocialPost | null; onClose: () => void }) {
  const { toast, node } = useToast();
  const connected = channels.filter((c) => c.connected).map((c) => c.id);
  const [chs, setChs] = useState<ChannelId[]>([]);
  const [tab, setTab] = useState<ChannelId>("instagram");
  const [tweaks, setTweaks] = useState<ToneTweak[]>([]);
  const [texts, setTexts] = useState<Partial<Record<ChannelId, string>>>({});
  const [edited, setEdited] = useState<Set<ChannelId>>(new Set());
  const open = !!(trend || post);

  useEffect(() => {
    if (post) { setChs(post.channels); setTab(post.channels[0]); setTexts(post.texts); setEdited(new Set(post.channels)); }
    else if (trend) {
      const first = trend.bestFor.filter((c) => connected.includes(c));
      setChs(first); setTab(first[0]); setTweaks([]); setEdited(new Set()); setTexts({});
    }
  }, [trend?.id, post?.id]);

  // Regenerate every channel the user hasn't typed into.
  useEffect(() => {
    if (!trend || post) return;
    setTexts((cur) => Object.fromEntries(chs.map((c) => [c, edited.has(c) ? cur[c] : draftFor(trend, c, tweaks)])));
  }, [trend?.id, chs.join(), tweaks.join()]);

  if (!open) return null;
  const toggleCh = (c: ChannelId) => {
    const next = chs.includes(c) ? chs.filter((x) => x !== c) : [...chs, c];
    setChs(next);
    if (!next.includes(tab) && next[0]) setTab(next[0]);
    if (!chs.includes(c)) setTab(c);
  };
  const remix = trend?.remix;
  const status = post?.status;

  const finish = (msg: string, act?: (id: string) => void) => {
    const id = post ? (savePost({ ...post, channels: chs, texts }), post.id) : remixTrend(trend!, chs, tweaks, texts).id;
    act?.(id);
    toast(msg);
    setTimeout(onClose, 700);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={980}
      title={post ? post.title : <span>Remix: {trend!.title}</span>}
      footer={<>
        {post && <Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => { removePost(post.id); onClose(); }}>Delete</Button>}
        <span className="flex-1" />
        {status === "scheduled" ? <Button onClick={() => finish("Moved back to drafts", unschedulePost)}>Unschedule</Button> : status !== "published" && <Button onClick={() => finish("Saved to drafts")}>Save draft</Button>}
        {status !== "published" && <Button onClick={() => finish("Posted", publishNow)} icon={<Send size={13} />} disabled={!chs.length}>Post now</Button>}
        {status !== "published" && status !== "scheduled" && <Button variant="primary" disabled={!chs.length} onClick={() => finish(`Scheduled for ${bestTime[chs[0]]}`, schedulePost)}>Schedule{chs[0] ? ` · ${bestTime[chs[0]]}` : ""}</Button>}
      </>}
    >
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
        {trend && (
          <div className="mb-5 rounded-lg bg-hover px-4 py-3 text-[13px] leading-[1.55]">
            <div className="font-medium">Why it works</div>
            <p className="m-0 text-muted">{trend.insight}</p>
            <div className="mt-2 font-medium">Your angle</div>
            <p className="m-0 text-muted">{trend.angle}</p>
          </div>
        )}

        <div className="mb-2 text-[12.5px] font-medium text-muted">Post to</div>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {channels.map((c) => {
            const on = chs.includes(c.id);
            return c.connected ? (
              <button key={c.id} onClick={() => toggleCh(c.id)} aria-pressed={on} className={cn("inline-flex h-8 items-center gap-2 rounded-full border pr-3 pl-1.5 text-[13px] transition-colors", on ? "border-ink bg-active" : "border-line text-muted hover:bg-hover")}>
                <ChannelBadge id={c.id} size={20} /> {c.name}
              </button>
            ) : (
              <Link key={c.id} to="/settings/integrations" className="inline-flex h-8 items-center gap-2 rounded-full border border-dashed border-line pr-3 pl-1.5 text-[13px] text-muted hover:bg-hover">
                <ChannelBadge id={c.id} size={20} /> Connect {c.name}
              </Link>
            );
          })}
        </div>

        {trend && !post && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12.5px] text-muted">Adjust</span>
            {tweakLabels.map((t) => (
              <button key={t.id} onClick={() => setTweaks(tweaks.includes(t.id) ? tweaks.filter((x) => x !== t.id) : [...tweaks, t.id])} aria-pressed={tweaks.includes(t.id)} className={cn("h-7 rounded-full border px-2.5 text-[12.5px] transition-colors", tweaks.includes(t.id) ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>{t.label}</button>
            ))}
            <span className="ml-auto text-[12px] text-subtle">In your voice · <Link to="/settings/brand" className="underline decoration-line-strong underline-offset-2 hover:text-fg">edit voice</Link></span>
          </div>
        )}

        {chs.length > 0 ? (
          <>
            <div role="tablist" className="flex gap-4 border-b border-line">
              {chs.map((c) => (
                <button key={c} role="tab" aria-selected={tab === c} onClick={() => setTab(c)} className={cn("-mb-px flex items-center gap-1.5 border-b-2 pb-2 text-[13px]", tab === c ? "border-ink text-fg" : "border-transparent text-muted hover:text-fg")}>
                  <ChannelBadge id={c} size={16} /> {channelOf(c).name}
                </button>
              ))}
            </div>
            <textarea
              aria-label={`${channelOf(tab).name} text`}
              value={texts[tab] ?? ""}
              onChange={(e) => { setTexts({ ...texts, [tab]: e.target.value }); setEdited(new Set(edited).add(tab)); }}
              rows={9}
              className="mt-3 w-full resize-y rounded-lg border border-line bg-surface p-3 text-[13.5px] leading-[1.55] outline-none focus:border-line-strong"
            />
            <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[12px] text-subtle">
              <span>{(texts[tab] ?? "").length} characters{edited.has(tab) && trend && !post ? " · edited, so Adjust leaves it alone" : ""}</span>
              <span>Best time on {channelOf(tab).name}: {bestTime[tab]}</span>
            </div>
          </>
        ) : <p className="text-[13px] text-muted">Pick at least one channel.</p>}

        {(remix?.scenes || post?.format) && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-muted"><Clapperboard size={13} /> {remix?.format ?? post?.format}</div>
            {remix?.scenes && (
              <ol className="m-0 list-decimal space-y-1 pl-5 text-[13px] text-muted">
                {remix.scenes.map((s) => <li key={s}>{s}</li>)}
              </ol>
            )}
          </div>
        )}
        {post?.stats && (
          <div className="mt-5">
            <div className="mb-2 text-[12.5px] font-medium text-muted">Results, from each platform's insights</div>
            <div className="overflow-hidden rounded-lg border border-line text-[12.5px]">
              {(Object.entries(post.stats) as [ChannelId, NonNullable<SocialPost["stats"]>[ChannelId]][]).map(([c, st]) => st && (
                <div key={c} className="num flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                  <ChannelBadge id={c} size={18} /><span className="w-24 text-fg">{channelOf(c).name}</span>
                  <span>{st.views.toLocaleString()} views</span>
                  {reactions(st) > 0 && <span className="text-muted">{st.likes.toLocaleString()} likes · {st.comments} comments · {st.shares} shares</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
        <aside className="md:sticky md:top-0">
          <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
            {chs.length ? <><ChannelBadge id={tab} size={16} /> Preview on {channelOf(tab).name}</> : "Preview"}
          </div>
          {chs.length > 0 && <PostPreview channel={tab} text={texts[tab] ?? ""} format={remix?.format ?? post?.format ?? "Post"} />}
          {chs.length > 1 && <p className="mt-2 text-[12px] text-subtle">Switch tabs to see the other channels.</p>}
        </aside>
      </div>
      {node}
    </Drawer>
  );
}
