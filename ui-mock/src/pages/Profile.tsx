import { useState } from "react";
import { useSearchParams } from "react-router";
import { Star, Phone, Navigation, MousePointerClick, Eye, Sparkles, Send, ImagePlus, Calendar, Check, Loader2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Delta, PageHeader, Progress, ScoreRing, Segmented, Tabs, cn, fmt, useToast } from "../components/ui";
import { business, gbpInsights, reviews as seed } from "../data/mock";

type Tab = "overview" | "reviews";

const completeness = [
  { label: "Primary category", done: true },
  { label: "Secondary categories (2 of 5)", done: false },
  { label: "Description with services", done: false },
  { label: "Hours, including holidays", done: true },
  { label: "Services (22)", done: true },
  { label: "Photos uploaded in the last 30 days", done: false },
  { label: "Booking link", done: true },
  { label: "Q&A seeded", done: false },
];

const draftReply = (name: string, rating: number) =>
  rating >= 4
    ? `Thank you, ${name.split(" ")[0]}! We're glad you had a great visit at our South Congress office. See you at your next appointment. — The Maple & Main team`
    : `Hi ${name.split(" ")[0]}, I'm sorry about the billing confusion. That's not the experience we want for anyone. Our office manager will call you this week to make sure everything is resolved. — Dr. Patel`;

export default function Profile() {
  // The tab lives in the URL so the sidebar can link straight to Reviews.
  const [params, setParams] = useSearchParams();
  const t = params.get("tab");
  const tab: Tab = t === "reviews" ? t : "overview";
  const setTab = (v: Tab) => setParams(v === "overview" ? {} : { tab: v }, { replace: true });
  const [reviews, setReviews] = useState(seed.map((r) => ({ ...r, draft: "" })));
  const [filter, setFilter] = useState<"unreplied" | "all">("unreplied");
  const [generating, setGenerating] = useState<string | null>(null);
  const { toast, node } = useToast();
  const pct = Math.round((completeness.filter((c) => c.done).length / completeness.length) * 100);

  const gen = (id: string) => {
    setGenerating(id);
    setTimeout(() => {
      setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, draft: draftReply(r.author, r.rating) } : r)));
      setGenerating(null);
    }, 700);
  };

  const shown = reviews.filter((r) => filter === "all" || !r.replied);

  return (
    <>
      <PageHeader
        title="Business Profile"
        sub={<span>{business.name} · {business.address}</span>}
        actions={<Badge tone="good"><Check size={11} /> Verified · synced 4 min ago</Badge>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Overview" },
        { id: "reviews", label: "Reviews", count: reviews.filter((r) => !r.replied).length },
      ]} />

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
                {[
                  [Eye, "Profile views", gbpInsights.views, gbpInsights.viewsPrev],
                  [Phone, "Calls", gbpInsights.calls, gbpInsights.callsPrev],
                  [Navigation, "Directions", gbpInsights.directions, gbpInsights.directionsPrev],
                  [MousePointerClick, "Website clicks", gbpInsights.websiteClicks, gbpInsights.websiteClicksPrev],
                ].map(([Icon, l, v, p]) => {
                  const I = Icon as typeof Eye;
                  return (
                    <div key={l as string} className="bg-surface p-5">
                      <div className="flex items-center gap-1.5 text-[12.5px] text-muted"><I size={13} />{l as string}</div>
                      <div className="num mt-1 font-serif text-[26px] leading-none">{fmt(v as number)}</div>
                      <div className="mt-1.5"><Delta cur={v as number} prev={p as number} /></div>
                    </div>
                  );
                })}
              </div>
              <Card>
                <CardHeader title="Reviews" sub="Last 90 days" />
                <div className="flex items-center gap-8">
                  <div>
                    <div className="num font-serif text-[40px] leading-none">{business.rating}</div>
                    <div className="mt-1 flex text-warn">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className={i < Math.round(business.rating) ? "fill-current" : ""} />)}</div>
                    <div className="num mt-1 text-[12.5px] text-muted">{business.reviews} reviews</div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[[5, 78], [4, 14], [3, 4], [2, 2], [1, 2]].map(([s, p]) => (
                      <div key={s} className="flex items-center gap-2 text-[12px]"><span className="num w-3 text-muted">{s}</span><Progress value={p} className="flex-1" /><span className="num w-8 text-right text-muted">{p}%</span></div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
            <Card>
              <div className="flex items-center gap-4">
                <ScoreRing score={pct} size={56} stroke={5} label="Profile completeness" />
                <div><div className="font-medium">Profile completeness</div><div className="text-[12.5px] text-muted">{completeness.filter((c) => !c.done).length} items left</div></div>
              </div>
              <ul className="mt-5 space-y-2">
                {completeness.map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className={cn("grid size-4 place-items-center rounded-full border", c.done ? "border-good bg-good text-white" : "border-line-strong")}>{c.done && <Check size={10} strokeWidth={3} />}</span>
                    <span className={cn(c.done && "text-muted")}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === "reviews" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <Segmented label="Filter reviews" value={filter} onChange={setFilter} options={[{ id: "unreplied", label: "Needs reply" }, { id: "all", label: "All" }]} />
              <Button size="sm" icon={<Sparkles size={13} />} onClick={() => shown.filter((r) => !r.replied && !r.draft).forEach((r) => gen(r.id))}>Draft all replies</Button>
            </div>
            <div className="space-y-3">
              {shown.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-[14px] font-medium">{r.author}<span className="flex text-warn">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={12} className="fill-current" />)}</span></div>
                      <div className="text-[12px] text-subtle">{r.date}</div>
                    </div>
                    {r.replied ? <Badge tone="good">Replied</Badge> : r.rating <= 2 && <Badge tone="bad">Needs attention</Badge>}
                  </div>
                  <p className="mt-2.5 text-[14px] leading-relaxed">{r.text}</p>
                  {!r.replied && (
                    <div className="mt-4">
                      {r.draft ? (
                        <>
                          <textarea aria-label={`Reply to ${r.author}`} value={r.draft} onChange={(e) => setReviews((rs) => rs.map((x) => (x.id === r.id ? { ...x, draft: e.target.value } : x)))} rows={3} className="w-full resize-none rounded-lg border border-line bg-bg p-3 text-[13.5px] outline-none focus:border-line-strong" />
                          <div className="mt-2 flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => gen(r.id)}>Regenerate</Button>
                            <Button size="sm" variant="primary" icon={<Send size={12} />} onClick={() => { setReviews((rs) => rs.map((x) => (x.id === r.id ? { ...x, replied: true } : x))); toast("Reply published to Google"); }}>Publish reply</Button>
                          </div>
                        </>
                      ) : (
                        <Button size="sm" icon={generating === r.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} onClick={() => gen(r.id)}>Draft reply</Button>
                      )}
                    </div>
                  )}
                </Card>
              ))}
              {!shown.length && <Card className="py-12 text-center text-[13.5px] text-muted">All caught up.</Card>}
            </div>
          </>
        )}

      </div>
      {node}
    </>
  );
}
