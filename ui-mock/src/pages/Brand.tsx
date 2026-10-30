import { useState } from "react";
import { Link } from "react-router";
import { Plus, RefreshCw, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, useToast } from "../components/ui";
import { brandFacts, inVoice, usedBy, voice } from "../data/brand";

// Who the business is and how it sounds. Belongs to the business, not a
// location or a channel, and is background information for every skill.
export default function Brand() {
  const { toast, node } = useToast();
  const [traits, setTraits] = useState(voice.traits);
  const [use, setUse] = useState(voice.use);
  const [avoid, setAvoid] = useState(voice.avoid);
  const [summary, setSummary] = useState(voice.summary);
  const [services, setServices] = useState(brandFacts.services);
  const [diffs, setDiffs] = useState(brandFacts.differentiators);
  const [offers, setOffers] = useState(brandFacts.offers);
  const [rules, setRules] = useState(brandFacts.rules);
  const [sample, setSample] = useState("Experience painless dentistry at the best in Austin clinic! Schedule an appointment today, limited time offer!");

  return (
    <>
      <PageHeader
        title="Brand voice"
        sub={<>Who {brandFacts.name} is and how it sounds. Shared by {brandFacts.locations.length === 1 ? "your location" : `both locations (${brandFacts.locations.join(" and ")})`} and used in everything Marko writes.</>}
        actions={<Button icon={<RefreshCw size={14} />} onClick={() => toast("Re-learning from your latest posts, replies and website")}>Re-learn</Button>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
        <span className="mr-1">Used in</span>
        {usedBy.map((u) => <Badge key={u}>{u}</Badge>)}
        <Link to="/settings/skills" className="ml-1 hover:text-fg">See skills →</Link>
      </div>

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Your voice in a sentence" sub={`Learned from ${voice.learnedFrom.join(", ")}.`} />
            <textarea aria-label="Voice summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="w-full resize-y rounded-lg border border-line bg-surface p-3 text-[14px] leading-[1.55] outline-none focus:border-line-strong" />
          </Card>

          <Card>
            <CardHeader title="Tone" />
            <div className="flex flex-col gap-5">
              {traits.map((t) => (
                <label key={t.id} className="block">
                  <span className="mb-1.5 flex justify-between text-[13px]"><span className="text-muted">{t.left}</span><span className="text-muted">{t.right}</span></span>
                  <input type="range" min={0} max={100} value={t.value} aria-label={`${t.left} to ${t.right}`} onChange={(e) => setTraits(traits.map((x) => (x.id === t.id ? { ...x, value: Number(e.target.value) } : x)))} className="w-full accent-[var(--accent)]" />
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Words" sub="Marko uses the first list where it fits and never the second." />
            <WordList label="Say" words={use} onChange={setUse} />
            <div className="mt-4"><WordList label="Never say" words={avoid} onChange={setAvoid} /></div>
          </Card>

          <Card>
            <CardHeader title="Sounds like you" />
            <p className="m-0 rounded-lg bg-good-soft/50 px-3 py-2.5 text-[13.5px] leading-[1.55]">{voice.examples.like}</p>
            <div className="mt-4 mb-2 text-[14px] font-medium">Doesn't</div>
            <p className="m-0 rounded-lg bg-bad-soft/50 px-3 py-2.5 text-[13.5px] leading-[1.55] text-muted">{voice.examples.unlike}</p>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Business facts" sub="What Marko can say about you. It won't make up anything that isn't here." />
            <dl className="m-0 grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-[13.5px]">
              <dt className="text-muted">Business</dt><dd className="m-0">{brandFacts.name} · {brandFacts.category}</dd>
              <dt className="text-muted">Locations</dt><dd className="m-0">{brandFacts.locations.join(", ")}</dd>
              <dt className="text-muted">Hours</dt><dd className="m-0">{brandFacts.hours}</dd>
              <dt className="text-muted">Contact</dt><dd className="m-0">{brandFacts.phone} · {brandFacts.website}</dd>
              <dt className="text-muted">Who it's for</dt><dd className="m-0">{brandFacts.audience}</dd>
            </dl>
            <div className="mt-5 flex flex-col gap-4">
              <WordList label="Services" words={services} onChange={setServices} />
              <WordList label="What makes you different" words={diffs} onChange={setDiffs} />
              <WordList label="Current offers" words={offers} onChange={setOffers} />
              <WordList label="Rules Marko always follows" words={rules} onChange={setRules} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Try it" sub="Paste anything and see it in your voice." />
            <textarea aria-label="Text to rewrite" value={sample} onChange={(e) => setSample(e.target.value)} rows={3} className="w-full resize-y rounded-lg border border-line bg-surface p-3 text-[13.5px] leading-[1.55] outline-none focus:border-line-strong" />
            <div className="mt-3 text-[12.5px] font-medium text-muted">In your voice</div>
            <p className="mt-1 mb-0 whitespace-pre-line rounded-lg bg-hover px-3 py-2.5 text-[13.5px] leading-[1.55]">{inVoice(sample) || "…"}</p>
          </Card>
        </div>
      </div>
      {node}
    </>
  );
}

export function WordList({ label, words, onChange }: { label: string; words: string[]; onChange: (w: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => { const w = draft.trim(); if (w && !words.includes(w)) onChange([...words, w]); setDraft(""); };
  return (
    <div>
      <div className="mb-2 text-[12.5px] font-medium text-muted">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {words.map((w) => (
          <span key={w} className="inline-flex min-h-7 items-center gap-1 rounded-full border border-line bg-surface py-0.5 pr-1 pl-2.5 text-[12.5px]">
            {w}
            <button onClick={() => onChange(words.filter((x) => x !== w))} aria-label={`Remove “${w}”`} className="grid size-5 shrink-0 place-items-center rounded-full text-subtle hover:bg-hover hover:text-fg"><X size={11} /></button>
          </span>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong pr-1 pl-2.5">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add" aria-label={`Add to ${label}`} className="w-20 bg-transparent text-[12.5px] outline-none" />
          <button type="submit" aria-label="Add" className="grid size-5 place-items-center rounded-full text-subtle hover:bg-hover hover:text-fg"><Plus size={11} /></button>
        </form>
      </div>
    </div>
  );
}
