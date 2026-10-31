import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Bookmark, BookmarkCheck, Check, ChevronDown, Copy, ExternalLink, Flame, Loader2, Plus, Radar, Settings2, Trash2, Undo2, Wand2, X } from "lucide-react";
import { Badge, Button, Card, Drawer, PageHeader, Segmented, Tabs, Toggle, cn, fmt, useToast } from "../components/ui";
import { PlatformMark, PostDrawer } from "../components/Social";
import { WordList } from "./Brand";
import { trendSources, type Trend } from "../data/social";
import { opportunities, platformOf, platforms, type Opportunity, type PlatformId } from "../data/scanner";
import {
  activeSources, addSource, draftOf, editDraft, frequencyLabels, openOpportunities, removeSource, scanNow, setOppStatus, statusOf,
  updateConfig, updateSource, updateTrending, useScanner, visibleTrends, type Frequency, type TermGroup,
} from "../lib/scanner";
import { useSocialPosts } from "../lib/social";
import { timeAgo } from "../lib/runs";
import { saveTrend, savedTrend, unsaveTrend, useSwipes } from "../lib/swipes";
import { useWatched } from "../lib/watch";
import { WatchEditor } from "../components/Watch";
import { postAsTrend, profileUrl, standoutPosts, type StandoutPost, type WatchKind, type WatchedProfile } from "../data/watch";

type Tab = "reply" | "trending" | "watching";

// One place to find what to do on social: conversations to join (Reply) and
// what's catching on to make your own (Trending). Settings decide what's scanned.
export default function SocialScanner() {
  const [params, setParams] = useSearchParams();
  // ?tab=remix is the old name for Trending.
  const p = params.get("tab");
  const tab: Tab = p === "trending" || p === "remix" ? "trending" : p === "watching" ? "watching" : "reply";
  const watched = useWatched();
  const [settings, setSettings] = useState(false);
  const { scannedAt, scanning, config } = useScanner();
  const on = activeSources(config);
  const trendOn = trendSources.filter((s) => config.trending.sources[s.id]);

  return (
    <>
      <PageHeader
        title="Social scanner"
        sub="Conversations about dentists in Austin you should join, and what's catching on that you can make your own. Every reply and post is written in your brand voice."
        actions={<>
          <Button icon={<Settings2 size={14} />} onClick={() => setSettings(true)}>Settings</Button>
          <Button icon={scanning ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />} disabled={scanning} onClick={scanNow}>{scanning ? "Scanning…" : "Scan now"}</Button>
        </>}
      />

      <button onClick={() => setSettings(true)} className="mb-6 flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-1 py-1 text-left text-[12.5px] text-muted hover:bg-hover/50">
        {tab === "reply" ? (
          <>
            <span className="flex items-center gap-1">{on.map((p) => <PlatformBadge key={p} id={p} size={18} />)}</span>
            <span>Scanned {on.map((p) => platformOf(p).name).join(", ") || "nothing"} {timeAgo(scannedAt)}, {frequencyLabels[config.frequency]}</span>
            <span className="text-subtle">· Listening for {Object.values(config.terms).flat().length} terms · Change</span>
          </>
        ) : tab === "watching" ? (
          <span>Watching {watched.filter((w) => w.kind === "Competitor").length} competitors and {watched.filter((w) => w.kind === "Inspiration").length} profiles you like, checked {frequencyLabels[config.frequency]}</span>
        ) : (
          <>
            <span>Trends from {trendOn.map((s) => s.name).join(", ") || "nothing"}, checked {frequencyLabels[config.trending.frequency]}</span>
            <span className="text-subtle">· About {config.trending.topics.join(", ")} · {config.trending.area} · Fit {config.trending.minFit}+ · Change</span>
          </>
        )}
      </button>

      <Tabs value={tab} onChange={(t) => setParams(t === "reply" ? {} : { tab: t }, { replace: true })} tabs={[
        { id: "reply", label: "Reply", count: openOpportunities().length },
        { id: "trending", label: "Trending", count: visibleTrends(config).length },
        { id: "watching", label: "Watching", count: standoutPosts.filter((sp) => watched.some((w) => w.id === sp.profileId)).length },
      ]} />
      <div className="mt-5">{tab === "reply" ? <ReplyList /> : tab === "trending" ? <TrendingList /> : <WatchingList />}</div>

      <ScanSettings open={settings} initial={tab} onClose={() => setSettings(false)} />
    </>
  );
}

export function PlatformBadge({ id, size = 20 }: { id: PlatformId; size?: number }) {
  const p = platformOf(id);
  return <span title={p.name} className="grid shrink-0 place-items-center rounded-md font-bold" style={{ width: size, height: size, background: p.bg, color: p.fg, fontSize: size * 0.42 }}>{p.short}</span>;
}

// ---------- Reply ----------

function ReplyList() {
  const { config } = useScanner();
  const on = activeSources(config);
  const [platform, setPlatform] = useState<PlatformId | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inPlatform = (o: Opportunity) => on.includes(o.platform) && (platform === "all" || o.platform === platform);
  const open = openOpportunities().filter(inPlatform);
  const done = opportunities.filter((o) => statusOf(o.id) !== "open" && inPlatform(o));
  const first = expanded ?? open[0]?.id ?? null;

  return (
    <>
      <p className="mt-0 mb-4 text-[13.5px] text-muted">People asking for a dentist, questions you can answer, and posts that mention you. Each has a reply ready: copy it, open the post, paste.</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["all", ...on] as const).map((id) => (
          <button key={id} onClick={() => setPlatform(id)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors", platform === id ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>
            {id === "all" ? "All" : platformOf(id).name}
            <span className="num opacity-70">{openOpportunities().filter((o) => id === "all" || o.platform === id).length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {open.map((o) => <OppCard key={o.id} o={o} open={first === o.id} onToggle={() => setExpanded(first === o.id ? "" : o.id)} />)}
        {!open.length && <Card className="py-10 text-center text-[13.5px] text-muted">Nothing new to reply to. The next scan runs {frequencyLabels[config.frequency]}.</Card>}
      </div>

      {done.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowDone(!showDone)} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
            <ChevronDown size={14} className={cn("transition-transform", !showDone && "-rotate-90")} /> {done.length} replied or dismissed
          </button>
          {showDone && (
            <Card pad={false} className="mt-3">
              {done.map((o) => (
                <div key={o.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <PlatformBadge id={o.platform} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{o.title}</span>
                  <Badge tone={statusOf(o.id) === "replied" ? "good" : "neutral"} className="capitalize">{statusOf(o.id)}</Badge>
                  <button onClick={() => setOppStatus(o.id, "open")} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12.5px] text-muted hover:bg-hover"><Undo2 size={12} /> Undo</button>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </>
  );
}

const kindTone = { "Asking for a dentist": "accent", "Mentions you": "info", "Question you can answer": "neutral" } as const;

function OppCard({ o, open, onToggle }: { o: Opportunity; open: boolean; onToggle: () => void }) {
  const { toast, node } = useToast();
  const p = platformOf(o.platform);
  const text = draftOf(o.id);
  const copyAndOpen = async () => {
    try { await navigator.clipboard.writeText(text); } catch {}
    window.open(o.url, "_blank", "noopener");
    toast(`Reply copied. Paste it on ${p.name}, then mark it replied.`);
  };

  return (
    <Card pad={false} className={cn("overflow-hidden", open && "border-line-strong")}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-hover/40">
        <PlatformBadge id={o.platform} size={28} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
            <span className="font-medium text-fg">{o.community}</span><span>· {o.author} · {o.age}</span><span className="hidden sm:inline">· {o.stats}</span>
          </span>
          <span className="mt-0.5 block text-[14.5px] leading-snug font-medium">{o.title}</span>
          {!open && o.excerpt && <span className="mt-0.5 block truncate text-[13px] text-muted">{o.excerpt}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={kindTone[o.kind]}>{o.kind}</Badge>
          <span className="num text-[11.5px] text-subtle">Fit {o.fit}</span>
        </span>
      </button>

      {open && (
        <div className="anim-fade border-t border-line px-4 pt-3 pb-4 sm:pl-[60px]">
          {o.excerpt && <p className="m-0 border-l-2 border-line pl-3 text-[13.5px] leading-[1.55] text-muted">{o.excerpt}</p>}
          <p className="mt-3 mb-0 text-[13px]"><span className="font-medium">Why reply: </span><span className="text-muted">{o.why}</span></p>

          <label className="mt-4 block">
            <span className="mb-1.5 flex items-baseline justify-between text-[12.5px] font-medium text-muted">Your reply <span className="font-normal text-subtle">{text.length} characters</span></span>
            <textarea value={text} onChange={(e) => editDraft(o.id, e.target.value)} rows={Math.min(10, Math.max(4, Math.ceil(text.length / 80)))} className="w-full resize-y rounded-lg border border-line bg-surface p-3 text-[13.5px] leading-[1.55] outline-none focus:border-line-strong" />
          </label>
          <div className="mt-1 text-[11.5px] text-subtle">Written with the <Link to="/settings/skills" className="underline decoration-line-strong underline-offset-2 hover:text-fg">Community replies</Link> skill, in your brand voice.</div>

          <ul className="mt-3 mb-0 space-y-1 pl-0 text-[12.5px] text-muted">
            {o.tips.map((t) => <li key={t} className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-good" />{t}</li>)}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<Copy size={13} />} onClick={copyAndOpen}>Copy reply & open {p.name} <ExternalLink size={12} /></Button>
            <Button icon={<Check size={13} />} onClick={() => { setOppStatus(o.id, "replied"); toast("Marked as replied"); }}>Mark replied</Button>
            <Button variant="ghost" icon={<X size={13} />} onClick={() => setOppStatus(o.id, "dismissed")}>Not for us</Button>
          </div>
        </div>
      )}
      {node}
    </Card>
  );
}

// ---------- Trending ----------

function TrendingList() {
  const { config } = useScanner();
  const [open, setOpen] = useState<Trend | null>(null);
  const posts = useSocialPosts();
  useSwipes();
  const shown = visibleTrends(config);
  const usedBy = (t: Trend) => posts.find((p) => p.trendId === t.id);

  return (
    <>
      <p className="mt-0 mb-4 text-[13.5px] text-muted">What's catching on with dentists and in Austin this week, and why it works. Remix one in your voice, then schedule or post it to your accounts.</p>
      <Card pad={false}>
        {shown.map((t) => {
          const used = usedBy(t);
          const saved = savedTrend(t.id);
          return (
            <article key={t.id} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 md:flex-row md:items-start md:gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                  <Badge>{t.kind}</Badge>
                  <span className="inline-flex items-center gap-1 font-medium text-accent"><Flame size={12} /> {t.velocity}</span>
                  <span className="text-subtle">· {t.source}</span>
                </div>
                <h2 className="mt-1.5 mb-0 text-[15.5px] leading-snug font-medium">{t.title}</h2>
                <p className="mt-1.5 mb-0 text-[13.5px] leading-[1.55] text-muted">{t.insight}</p>
                <p className="mt-1.5 mb-0 text-[13.5px] leading-[1.55]"><span className="font-medium">Your version: </span>{t.angle}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-subtle">
                  {t.bestFor.map((c) => <PlatformMark key={c} platform={c} size={16} />)}
                  <span>{t.remix.format}</span>
                  {used && <Link to="/social/posts" className="ml-1 text-muted hover:text-fg">· {used.status === "published" ? "Posted" : used.status === "scheduled" ? "Scheduled" : "In drafts"} →</Link>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-end">
                <span className="num text-[12px] text-subtle">Fit {t.fit}</span>
                <Button size="sm" variant={used ? "secondary" : "primary"} icon={<Wand2 size={12} />} onClick={() => setOpen(t)}>{used ? "Remix again" : "Remix in my voice"}</Button>
                <button onClick={() => (saved ? unsaveTrend(t.id) : saveTrend(t))} aria-pressed={saved} title={saved ? "In your swipe file. Click to remove." : "Keep this format in your swipe file"} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] transition-colors hover:bg-hover", saved ? "text-accent" : "text-muted hover:text-fg")}>
                  {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {saved ? "In swipe file" : "Save to swipe file"}
                </button>
              </div>
            </article>
          );
        })}
        {!shown.length && <div className="px-5 py-10 text-center text-[13.5px] text-muted">Nothing above fit {config.trending.minFit} from the sources you have on. Lower the fit bar or add sources in Settings.</div>}
      </Card>
      <PostDrawer trend={open} onClose={() => setOpen(null)} />
    </>
  );
}

// ---------- Watching ----------

function WatchingList() {
  const watched = useWatched();
  useSwipes();
  const [kind, setKind] = useState<"all" | WatchKind>("all");
  const [open, setOpen] = useState<Trend | null>(null);
  const posts = standoutPosts
    .map((p) => ({ p, w: watched.find((x) => x.id === p.profileId) }))
    .filter((x): x is { p: StandoutPost; w: WatchedProfile } => !!x.w && (kind === "all" || x.w.kind === kind))
    .sort((a, b) => b.p.multiple - a.p.multiple);

  return (
    <>
      <p className="mt-0 mb-4 text-[13.5px] text-muted">Posts from competitors and profiles you like that did much better than their usual. Keep the idea, make it yours.</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["all", "Competitor", "Inspiration"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn("h-7 rounded-full border px-2.5 text-[12.5px] transition-colors", kind === k ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>{k === "all" ? "All" : k === "Competitor" ? "Competitors" : "Inspiration"}</button>
        ))}
      </div>
      <Card pad={false}>
        {posts.map(({ p, w }) => {
          const t = postAsTrend(p, w);
          const saved = savedTrend(t.id);
          return (
            <article key={p.id} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 md:flex-row md:items-start md:gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                  <PlatformMark platform={w.platform} size={16} />
                  <a href={profileUrl(w)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-fg hover:underline">{w.handle} <ExternalLink size={11} /></a>
                  <Badge tone={w.kind === "Competitor" ? "warn" : "accent"}>{w.kind}</Badge>
                  <span className="text-subtle">· {p.format} · {p.posted}</span>
                </div>
                <h2 className="mt-1.5 mb-0 text-[15.5px] leading-snug font-medium">{p.caption}</h2>
                <div className="num mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent"><Flame size={12} /> {fmt(p.views)} views · {p.multiple}× their usual</div>
                <p className="mt-1.5 mb-0 text-[13.5px] leading-[1.55] text-muted">{p.why}</p>
                <p className="mt-1.5 mb-0 text-[13.5px] leading-[1.55]"><span className="font-medium">Your version: </span>{p.angle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-end">
                <Button size="sm" variant="primary" icon={<Wand2 size={12} />} onClick={() => setOpen(t)}>Remix in my voice</Button>
                <button onClick={() => (saved ? unsaveTrend(t.id) : saveTrend(t))} aria-pressed={saved} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] transition-colors hover:bg-hover", saved ? "text-accent" : "text-muted hover:text-fg")}>
                  {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {saved ? "In swipe file" : "Save to swipe file"}
                </button>
              </div>
            </article>
          );
        })}
        {!posts.length && <div className="px-5 py-10 text-center text-[13.5px] text-muted">No standout posts from these profiles this week. Add more below.</div>}
      </Card>

      <h2 className="mt-8 mb-1 text-[15px] font-medium">Who you're watching</h2>
      <p className="mt-0 mb-3 text-[13px] text-muted">Competitors, and anyone whose posts you'd like to learn from, in any line of business.</p>
      <Card pad={false}><WatchEditor /></Card>
      <PostDrawer trend={open} onClose={() => setOpen(null)} />
    </>
  );
}

// ---------- Settings ----------

const freqOptions = (["hourly", "6h", "daily", "weekly"] as Frequency[]).map((f) => ({ id: f, label: { hourly: "Hourly", "6h": "Every 6 h", daily: "Daily", weekly: "Weekly" }[f] }));

function Section({ title, sub, children, right }: { title: string; sub?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-line pb-6 last:border-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><h3 className="m-0 text-[14px] font-medium">{title}</h3>{sub && <p className="mt-0.5 mb-0 text-[12.5px] text-muted">{sub}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

function ScanSettings({ open, initial, onClose }: { open: boolean; initial: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initial);
  const [adding, setAdding] = useState(false);
  const { config } = useScanner();
  const t = config.trending;
  useEffect(() => { if (open) setTab(initial); }, [open]);
  if (!open) return null;
  const notAdded = platforms.filter((p) => !config.sources.some((s) => s.platform === p.id));

  return (
    <Drawer open onClose={onClose} width={620} title="Scanner settings" footer={<Button variant="primary" onClick={() => { onClose(); scanNow(); }}>Done, scan now</Button>}>
      <div className="mb-5"><Segmented label="Settings for" value={tab} onChange={setTab} options={[{ id: "reply", label: "Reply" }, { id: "trending", label: "Trending" }, { id: "watching", label: "Watching" }]} /></div>

      {tab === "watching" ? (
        <Section title="Profiles to watch" sub="Competitors, and anyone whose posts you'd like to learn from. Their posts that beat their usual show up under Watching.">
          <div className="overflow-hidden rounded-lg border border-line"><WatchEditor compact /></div>
        </Section>
      ) : tab === "reply" ? (
        <div className="flex flex-col gap-6">
          <Section title="Where to look" sub="Each source and the places on it to watch." right={notAdded.length > 0 && <Button size="sm" icon={<Plus size={13} />} onClick={() => setAdding(!adding)}>Add source</Button>}>
            {adding && (
              <div className="mb-3 flex flex-wrap gap-1.5 rounded-lg bg-hover p-2.5">
                {notAdded.map((p) => (
                  <button key={p.id} onClick={() => { addSource(p.id); setAdding(false); }} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface pr-3 pl-1.5 text-[13px] hover:border-line-strong">
                    <PlatformBadge id={p.id} size={20} /> {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-line">
              {config.sources.map((s) => {
                const p = platformOf(s.platform);
                return (
                  <div key={s.platform} className={cn("border-b border-line px-4 py-3.5 last:border-0", !s.enabled && "bg-hover/40")}>
                    <div className="flex items-center gap-3">
                      <PlatformBadge id={s.platform} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium">{p.name}</div>
                        <div className="text-[12px] text-muted">
                          {!p.login ? "Public search, no login needed" : s.connected ? <span className="text-good">Connected</span> : "Needs your account to search"}
                        </div>
                      </div>
                      {p.login && !s.connected
                        ? <Button size="sm" variant="primary" onClick={() => updateSource(s.platform, { connected: true })}>Connect</Button>
                        : <Toggle label={`Scan ${p.name}`} checked={s.enabled} onChange={(v) => updateSource(s.platform, { enabled: v })} />}
                      <button onClick={() => removeSource(s.platform)} aria-label={`Remove ${p.name}`} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-hover hover:text-bad"><Trash2 size={13} /></button>
                    </div>
                    {s.enabled && (
                      <div className="mt-3 pl-[38px]">
                        <WordList label={p.places} words={s.places} onChange={(places) => updateSource(s.platform, { places })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="What to listen for" sub="Posts that mention any of these, in the places above.">
            <div className="flex flex-col gap-4">
              {(Object.keys(config.terms) as TermGroup[]).map((g) => (
                <WordList key={g} label={g} words={config.terms[g]} onChange={(w) => updateConfig({ terms: { ...config.terms, [g]: w } })} />
              ))}
            </div>
          </Section>

          <Section title="How often">
            <div className="flex flex-col gap-4 text-[13.5px]">
              <div className="flex flex-wrap items-center justify-between gap-3"><span>Scan</span><Segmented label="Scan frequency" value={config.frequency} onChange={(f) => updateConfig({ frequency: f })} options={freqOptions} /></div>
              <div className="flex flex-wrap items-center justify-between gap-3"><span>Only posts from the last</span><Segmented label="Post age" value={config.maxAge} onChange={(a) => updateConfig({ maxAge: a })} options={[{ id: "24h", label: "24 hours" }, { id: "3d", label: "3 days" }, { id: "7d", label: "7 days" }]} /></div>
              <div className="flex items-center justify-between gap-3"><span>Tell me right away when someone mentions us</span><Toggle label="Alert on mentions" checked={config.alertOnMentions} onChange={(v) => updateConfig({ alertOnMentions: v })} /></div>
            </div>
          </Section>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Section title="Where trends come from">
            <div className="overflow-hidden rounded-lg border border-line">
              {trendSources.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium">{s.name}</div><div className="text-[12px] text-muted">{s.what}</div></div>
                  <Toggle label={`Use ${s.name}`} checked={t.sources[s.id]} onChange={(v) => updateTrending({ sources: { ...t.sources, [s.id]: v } })} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="What's relevant to you" sub="Trends are scored for fit against these and your brand voice.">
            <div className="flex flex-col gap-4">
              <WordList label="Topics" words={t.topics} onChange={(topics) => updateTrending({ topics })} />
              <div className="flex flex-wrap items-center justify-between gap-3 text-[13.5px]">
                <label className="flex items-center gap-2">Area
                  <input value={t.area} onChange={(e) => updateTrending({ area: e.target.value })} aria-label="Area" className="h-8 w-40 rounded-md border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-line-strong" />
                </label>
                <Segmented label="Reach" value={t.reach} onChange={(reach) => updateTrending({ reach })} options={[{ id: "city", label: "City" }, { id: "state", label: "State" }, { id: "country", label: "Country" }]} />
              </div>
              <WordList label="Never suggest" words={t.avoid} onChange={(avoid) => updateTrending({ avoid })} />
            </div>
          </Section>

          <Section title="How picky">
            <label className="block text-[13.5px]">
              <span className="mb-1.5 flex justify-between"><span>Only show trends with a fit of at least</span><span className="num font-medium">{t.minFit}</span></span>
              <input type="range" min={0} max={95} step={5} value={t.minFit} aria-label="Minimum fit" onChange={(e) => updateTrending({ minFit: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
              <span className="mt-1 flex justify-between text-[12px] text-subtle"><span>Show me everything</span><span>Only sure bets</span></span>
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13.5px]"><span>Look for new trends</span><Segmented label="Trend frequency" value={t.frequency} onChange={(f) => updateTrending({ frequency: f })} options={freqOptions} /></div>
          </Section>
        </div>
      )}
    </Drawer>
  );
}
