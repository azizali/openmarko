import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, ExternalLink, Loader2, Play, ShieldCheck, Star } from "lucide-react";
import { Badge, Button, Checkbox, Field, FieldLabel, Input, Modal, Segmented, Select, cn } from "./ui";
import { adPlatforms, angles, formats, type AdPlatform, type Angle, type Format, type Size, type Tool } from "../data/ads";
import { brandFacts } from "../data/brand";
import { locations } from "../data/mock";
import { shortLocation } from "../data/org";
import { cadences, connectTool, connectedPlatforms, dailyBudget, money, publishAds, useAds, verdicts, type PublishAd, type Verdict } from "../lib/ads";
import { setCreativeStatus, type Style } from "../lib/creatives";
import { assistant, product } from "../lib/whitelabel";

export function AdPlatformMark({ platform, size = 20 }: { platform: AdPlatform; size?: number }) {
  const m = adPlatforms[platform];
  return <span title={m.name} className="grid shrink-0 place-items-center rounded-md font-semibold text-white" style={{ width: size, height: size, background: m.color, fontSize: size * 0.42 }}>{m.short}</span>;
}

export function ToolMark({ tool, size = 32 }: { tool: Tool; size?: number }) {
  return <span className="grid shrink-0 place-items-center rounded-lg font-semibold text-white" style={{ width: size, height: size, background: tool.color, fontSize: size * 0.36 }}>{tool.mark}</span>;
}

export function VerdictBadge({ v }: { v: Verdict }) {
  return <Badge tone={verdicts[v].tone}>{verdicts[v].label}</Badge>;
}

const ratio: Record<Size, number> = { "1:1": 1, "4:5": 1.25, "9:16": 16 / 9, "1.91:1": 1 / 1.91 };
/** The look a library ad most likely has, for its thumbnail. */
export const styleFor = (angle: Angle, format: Format): Style => (format === "video" ? "ugc" : angle === "proof" ? "review" : angle === "price" ? "type" : "photo");

/**
 * A drawn stand-in for a rendered creative: the headline over the style, in
 * the angle's color, at the right shape. Real build: the rendered image or
 * video frame from the renderer.
 */
export function CreativeThumb({ angle, format, style: picked, headline, brand = brandFacts.name, site = brandFacts.website, size = "1:1", w = 72 }: { angle: Angle; format: Format; style: Style; headline: string; brand?: string; site?: string; size?: Size; w?: number }) {
  const style = picked === "review" && w < 64 ? "type" : picked; // a review card is unreadable that small
  const h = angles[angle].hue;
  const fs = Math.max(7, w * (size === "1.91:1" ? 0.07 : 0.085));
  const box = { width: w, height: w * ratio[size] };
  if (format === "search" && w < 64) return (
    <div className="flex shrink-0 flex-col justify-center gap-1 rounded-md border border-line bg-surface p-1.5" style={{ width: w, height: w }} aria-hidden>
      <span className="h-1 w-1/2 rounded-full bg-line-strong" />
      <span className="h-1.5 w-full rounded-full bg-[#1a0dab]/70 dark:bg-[#8ab4f8]/70" />
      <span className="h-1 w-full rounded-full bg-line" /><span className="h-1 w-3/4 rounded-full bg-line" />
    </div>
  );
  if (format === "search") {
    return (
      <div className="shrink-0 overflow-hidden rounded-md border border-line bg-surface p-1.5 text-left" style={{ width: w, height: w }}>
        <div className="text-[7px] font-medium text-muted">Sponsored</div>
        <div className="truncate text-[7px] text-muted">{site}</div>
        <div className="mt-0.5 line-clamp-3 text-[8.5px] leading-tight font-medium text-[#1a0dab] dark:text-[#8ab4f8]">{headline}</div>
      </div>
    );
  }
  const brandChip = <div className="truncate font-semibold opacity-90" style={{ fontSize: fs * 0.62 }}>{brand}</div>;
  const play = (format === "video" || style === "ugc") && <span className="absolute top-1/2 left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white" style={{ width: w * 0.26, height: w * 0.26 }}><Play size={w * 0.12} fill="currentColor" /></span>;
  const dots = format === "carousel" && <div className="absolute right-1.5 bottom-1 flex gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className={cn("size-1 rounded-full", i ? "bg-white/50" : "bg-white")} />)}</div>;
  if (style === "type") return (
    <div className="relative flex shrink-0 flex-col justify-between overflow-hidden rounded-md p-[6%]" style={{ ...box, background: `hsl(${h} 70% 92%)`, color: `hsl(${h} 60% 20%)` }}>
      <div className="leading-[1.05] font-bold tracking-tight" style={{ fontSize: fs * 1.15 }}>{headline}</div>
      {brandChip}{dots}{play}
    </div>
  );
  if (style === "review") return (
    <div className="relative flex shrink-0 flex-col justify-center overflow-hidden rounded-md p-[7%]" style={{ ...box, background: `hsl(${h} 80% 88%)` }}>
      <div className="rounded bg-white p-[8%] text-[#111] shadow-sm">
        <div className="flex text-[#f5a623]">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={fs} fill="currentColor" strokeWidth={0} />)}</div>
        <div className="mt-0.5 line-clamp-4 leading-tight font-medium" style={{ fontSize: fs * 0.9 }}>{headline}</div>
      </div>
      <div className="mt-1 text-[#333]">{brandChip}</div>{dots}{play}
    </div>
  );
  if (style === "ugc") return (
    <div className="relative flex shrink-0 flex-col items-center justify-end overflow-hidden rounded-md p-[6%] pb-[14%]" style={{ ...box, background: `linear-gradient(160deg, hsl(${h} 25% 38%), hsl(${h + 20} 30% 16%))` }}>
      <div className="rounded bg-white px-1 py-0.5 text-center leading-tight font-semibold text-[#111]" style={{ fontSize: fs * 0.85 }}>{headline}</div>
      {play}
      <span className="absolute top-1 right-1.5 text-white/80" style={{ fontSize: fs * 0.6 }}>0:15</span>
    </div>
  );
  return (
    <div className="relative flex shrink-0 flex-col justify-between overflow-hidden rounded-md p-[6%] text-white" style={{ ...box, background: `radial-gradient(circle at 70% 30%, hsl(${h + 25} 55% 62%), transparent 55%), linear-gradient(150deg, hsl(${h} 50% 42%), hsl(${h + 10} 55% 22%))` }}>
      {brandChip}
      <div className="leading-[1.1] font-semibold drop-shadow" style={{ fontSize: fs }}>{headline}</div>
      {dots}{play}
    </div>
  );
}

// ---------- Connect ----------

const permissions: Record<string, string[]> = {
  ad: ["Read campaigns, ad sets, ads and results", "Create ads and campaigns you approve", "Pause ads and change budgets (within your guardrails)"],
  results: ["Read which clicks became bookings or calls", "Send bookings back so the platform finds more people like them"],
  other: ["Read and create files in this workspace"],
};

/** Sign in to a tool, pick the account, done. Real build: each platform's OAuth. */
export function ConnectToolModal({ tool, onClose }: { tool: Tool | null; onClose: () => void }) {
  const [step, setStep] = useState<"intro" | "auth" | "pick">("intro");
  const [pick, setPick] = useState(0);
  useEffect(() => { setStep("intro"); setPick(0); }, [tool?.id]);
  if (!tool) return null;
  const perms = permissions[tool.group === "Ad accounts" ? "ad" : tool.group === "Counting results" ? "results" : "other"];
  const accounts = [tool.account, tool.group === "Ad accounts" ? `${brandFacts.name} (old account, unused)` : null].filter(Boolean) as string[];
  const go = () => { setStep("auth"); setTimeout(() => setStep("pick"), 1100); };
  return (
    <Modal open onClose={onClose} title={`Connect ${tool.name}`} footer={
      step === "pick"
        ? <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Check size={14} />} onClick={() => { connectTool(tool.id); onClose(); }}>Use this account</Button></>
        : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={step === "auth"} icon={step === "auth" ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={13} />} onClick={go}>{step === "auth" ? "Waiting for sign-in…" : `Continue to ${tool.name.split(" ")[0]}`}</Button></>
    }>
      <div className="flex items-start gap-3">
        <ToolMark tool={tool} size={40} />
        <p className="m-0 text-[13.5px] leading-[1.55] text-muted">{tool.what}.</p>
      </div>
      {step !== "pick" ? (
        <div className="mt-4 rounded-lg border border-line p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium"><ShieldCheck size={13} className="text-good" />{product()} will be able to</div>
          <ul className="m-0 list-none space-y-1 pl-0 text-[13px]">{perms.map((p) => <li key={p} className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-muted" />{p}</li>)}</ul>
          {tool.group === "Ad accounts" && <p className="mt-2 mb-0 text-[12.5px] text-muted">New ads never go live without your approval unless you allow it in the goal's guardrails.</p>}
        </div>
      ) : (
        <fieldset className="mt-4 space-y-1.5">
          <legend className="mb-1.5 text-[12.5px] font-medium text-muted">Which account?</legend>
          {accounts.map((a, i) => (
            <label key={a} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[13.5px]", pick === i ? "border-ink bg-active" : "border-line hover:bg-hover")}>
              <input type="radio" checked={pick === i} onChange={() => setPick(i)} className="accent-[var(--ink)]" />{a}
            </label>
          ))}
        </fieldset>
      )}
    </Modal>
  );
}

// ---------- Publish ----------

/** Turns approved creatives into a test: a campaign with an ad set per angle, on one platform. */
export function PublishModal({ open, onClose, ads, batchId, batchName, onDone }: { open: boolean; onClose: () => void; ads: PublishAd[]; batchId: string; batchName: string; onDone: (msg: string) => void }) {
  const st = useAds();
  const live = connectedPlatforms(st);
  const fits = (p: AdPlatform) => ads.filter((a) => formats[a.format].platforms.includes(p));
  const best = live.slice().sort((a, b) => fits(b).length - fits(a).length)[0];
  const [platform, setPlatform] = useState<AdPlatform | undefined>(best);
  const [into, setInto] = useState<string>("new");
  const [name, setName] = useState(batchName);
  const [byAngle, setByAngle] = useState(true);
  const [budget, setBudget] = useState(15);
  const [places, setPlaces] = useState(locations.map((l) => l.id));
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (open) { setPlatform(best); setInto("new"); setName(batchName); } }, [open]);
  if (!open) return null;

  if (!platform) return (
    <Modal open onClose={onClose} title="Connect an ad account first">
      <p className="m-0 text-[13.5px] text-muted">Publishing needs Meta Ads, Google Ads or TikTok Ads connected.</p>
      <Link to="/settings/integrations?cat=Ads" className="mt-3 inline-block"><Button variant="primary">Open ad accounts</Button></Link>
    </Modal>
  );
  const ok = fits(platform);
  const skipped = ads.length - ok.length;
  const groups = byAngle ? new Set(ok.map((a) => a.angle)).size : 1;
  const camps = st.rows.filter((r) => r.level === "campaign" && r.platform === platform);
  const g = st.goal;
  const after = dailyBudget(st.rows.filter((r) => st.connected[r.platform])) + (paused ? 0 : budget * groups);
  const publish = () => {
    const cid = publishAds({ platform, name: name.trim() || batchName, into: into === "new" ? null : into, byAngle, budget, places: places.map(shortLocation), paused, batchId }, ok);
    setCreativeStatus(ok.map((a) => a.id), "published", cid);
    onDone(`${ok.length} ads published to ${adPlatforms[platform].name}${paused ? ", paused" : ""}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={560} title={`Publish ${ads.length} creative${ads.length === 1 ? "" : "s"}`} footer={
      <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok.length || !places.length} onClick={publish}>{paused ? "Create paused" : `Publish ${ok.length} ads`}</Button></>
    }>
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-muted">Where</div>
          <div className="flex flex-wrap gap-1.5">
            {live.map((p) => (
              <button key={p} onClick={() => { setPlatform(p); setInto("new"); }} aria-pressed={platform === p} className={cn("inline-flex h-9 items-center gap-2 rounded-lg border pr-3 pl-1.5 text-[13px]", platform === p ? "border-ink bg-active" : "border-line text-muted hover:bg-hover")}>
                <AdPlatformMark platform={p} size={22} />{adPlatforms[p].name}<span className="num text-subtle">{fits(p).length}</span>
              </button>
            ))}
          </div>
          {skipped > 0 && <p className="mt-1.5 mb-0 text-[12.5px] text-warn">{skipped} {skipped === 1 ? "creative doesn't" : "creatives don't"} fit {adPlatforms[platform].name} ({[...new Set(ads.filter((a) => !ok.includes(a)).map((a) => formats[a.format].label.toLowerCase()))].join(", ")}) and will stay approved for another platform.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Campaign">
            <Select value={into} onChange={(e) => setInto(e.target.value)}>
              <option value="new">New test campaign</option>
              {camps.map((c) => <option key={c.id} value={c.id}>Add to {c.name}</option>)}
            </Select>
          </Field>
          {into === "new" && (
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-muted">How to test</div>
          <Segmented label="Structure" value={byAngle ? "angle" : "one"} onChange={(v) => setByAngle(v === "angle")} options={[{ id: "angle", label: "Ad set per angle" }, { id: "one", label: "All in one ad set" }]} />
          <p className="mt-1.5 mb-0 text-[12.5px] text-muted">{byAngle ? "Each angle gets its own budget, so you learn which angle wins, not just which ad." : `${adPlatforms[platform].name} spreads the budget across all of them and favors early leaders. Faster, but a slow starter may never get a fair test.`}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Daily budget per ad set">
            <div className="relative"><span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span><Input type="number" min={5} value={budget} onChange={(e) => setBudget(Math.max(1, +e.target.value))} className="num pl-6" /></div>
          </Field>
          <div>
            <FieldLabel>Around</FieldLabel>
            <div className="flex flex-wrap gap-3 pt-2">
              {locations.map((l) => <label key={l.id} className="flex items-center gap-2 text-[13.5px]"><Checkbox checked={places.includes(l.id)} onChange={(v) => setPlaces(v ? [...places, l.id] : places.filter((x) => x !== l.id))} />{shortLocation(l.id)} · 3 mi</label>)}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13.5px]"><Checkbox checked={paused} onChange={setPaused} />Create paused, so I can check it in {adPlatforms[platform].name} first</label>
        <div className="rounded-lg bg-hover px-3.5 py-3 text-[13px] leading-[1.55]">
          {into === "new" ? "Creates 1 campaign with " : "Adds "}<b>{groups} ad set{groups === 1 ? "" : "s"}</b> and <b>{ok.length} ads</b>, <b className="num">{money(budget * groups)}</b> a day. {assistant()} reviews {cadences[g.cadence].label.toLowerCase()} and judges each ad after it spends <span className="num">{money(g.minSpend * g.target)}</span>; ads above <span className="num">{money(g.target * 1.5)}</span> a {g.result === "booking" ? "booking" : "result"} get paused, winners get more.
          {after > g.monthly / 30 && <div className="mt-1.5 text-warn">Daily budgets go to {money(after)}, over your {money(g.monthly / 30)} cap. {assistant()} won't scale anything until you cut elsewhere or raise the cap.</div>}
        </div>
      </div>
    </Modal>
  );
}
