// Adding AI questions and competitors by hand, in the SEO section. Keywords have their own dialog
// (AddKeywords.tsx). Both say what happens next: a question is asked on the next check; a competitor is
// read from the map, Google and AI results already collected, so adding one costs one profile lookup.

import { useState } from "react";
import { Check, MapPin, Plus, Star } from "lucide-react";
import { Button, cn, fmt, Modal, SearchInput, Textarea } from "../../components/ui";
import { candidates, engines, questionIdeas, type Candidate, type TrackedPrompt } from "../../mock/seo";

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

export function AddQuestions({
  open,
  onClose,
  tracked,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  tracked: TrackedPrompt[];
  onAdd: (texts: string[]) => void;
}) {
  const [text, setText] = useState("");
  const have = new Set(tracked.map((p) => p.text.toLowerCase()));
  const typed = [...new Set(text.split("\n").map(clean).filter(Boolean))];
  const fresh = typed.filter((t) => !have.has(t.toLowerCase()));
  const ideas = questionIdeas.filter((q) => !have.has(q.toLowerCase()) && !typed.includes(q));
  const close = () => {
    setText("");
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Add AI questions"
      width={560}
      footer={
        <>
          <p className="mr-auto self-center text-[12.5px] text-muted">Asked to {engines.map((e) => e.name).join(", ")} every week</p>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!fresh.length}
            onClick={() => {
              onAdd(fresh);
              close();
            }}
          >
            {fresh.length ? `Track ${fresh.length} question${fresh.length > 1 ? "s" : ""}` : "Track"}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="text-[13px] font-medium">What would a customer ask ChatGPT?</span>
        <span className="block text-[12.5px] text-muted">One per line, in full sentences, the way people talk. Mention the city.</span>
        <Textarea
          autoFocus
          className="mt-2 w-full"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Who is the best dentist for a root canal in Austin?"
        />
      </label>
      {typed.some((t) => have.has(t.toLowerCase())) && (
        <p className="mt-2 text-[12.5px] text-muted">Already tracked: {typed.filter((t) => have.has(t.toLowerCase())).join("; ")}</p>
      )}
      {typed.some((t) => t.split(" ").length < 4) && (
        <p className="mt-2 text-[12.5px] text-warn">
          Short phrases like “{typed.find((t) => t.split(" ").length < 4)}” work better as keywords. AI is asked whole questions.
        </p>
      )}
      {ideas.length > 0 && (
        <div className="mt-5">
          <p className="text-[13px] font-medium">Ideas</p>
          <p className="text-[12.5px] text-muted">From your services, your hours and what your reviews mention. Click to add.</p>
          <ul className="mt-2 space-y-1.5">
            {ideas.map((q) => (
              <li key={q}>
                <button
                  onClick={() => setText((text.trim() ? text.replace(/\s+$/, "") + "\n" : "") + q + "\n")}
                  className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-[13.5px] hover:border-line-strong hover:bg-hover"
                >
                  <Plus size={13} className="shrink-0 text-muted" />
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export function AddCompetitor({
  open,
  onClose,
  known,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** Names already listed, found or added. */
  known: string[];
  onAdd: (c: Candidate) => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Candidate | null>(null);
  const query = q.trim().toLowerCase();
  const matches = candidates.filter((c) => !query || c.name.toLowerCase().includes(query) || c.category.toLowerCase().includes(query));
  const close = () => {
    setQ("");
    setPicked(null);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Add a competitor"
      width={560}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!picked}
            onClick={() => {
              onAdd(picked!);
              close();
            }}
          >
            {picked ? `Watch ${picked.name}` : "Watch"}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-muted">
        Competitors are found for you from the results. Add one when you know a rival that doesn't show up yet: a new practice, or one
        across town your customers mention.
      </p>
      <SearchInput
        autoFocus
        className="mt-3 w-full"
        aria-label="Search Google Maps"
        placeholder="Business name, or paste a Google Maps link"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPicked(null);
        }}
      />
      <ul className="mt-3 space-y-1.5">
        {matches.map((c) => {
          const already = known.includes(c.name);
          const on = picked?.id === c.id;
          return (
            <li key={c.id}>
              <button
                disabled={already}
                onClick={() => setPicked(c)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                  on ? "border-ink" : "border-line hover:border-line-strong hover:bg-hover",
                )}
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{c.name}</span>
                  <span className="block text-[12.5px] text-muted">
                    {c.category} · {c.address} · {c.distanceMi} mi away
                  </span>
                </span>
                <span className="num flex shrink-0 items-center gap-1 text-[12.5px] text-muted">
                  {already ? (
                    "Already listed"
                  ) : (
                    <>
                      <Star size={11} className="fill-current text-warn" />
                      {c.rating} · {fmt(c.reviews)}
                    </>
                  )}
                </span>
                {on && <Check size={15} className="mt-0.5 shrink-0" />}
              </button>
            </li>
          );
        })}
        {matches.length === 0 && <li className="py-6 text-center text-[13px] text-muted">No business by that name near you.</li>}
      </ul>
      <p className="mt-4 text-[12.5px] text-muted">
        We find them in the map, Google and AI results we already collect for your keywords, so watching one costs no extra searches. Their
        profile (rating, reviews, photos) is one DataForSEO Business Data lookup a month.
      </p>
    </Modal>
  );
}
