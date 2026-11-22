// Adding keywords by hand, in the small Local SEO section. Type or paste them one per line; each line shows its
// searches a month before anything is tracked, and ones already tracked are skipped. Ideas can be added with a
// click. Used from the Google Maps ranking and Keywords pages.

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, cn, fmt, Modal, Textarea } from "../components/ui";
import {
  GRID_SPOTS,
  KEYWORD_LIMIT,
  keywordIdeas,
  volumeOf,
  type TrackedKeyword,
} from "../mock/local";

const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function AddKeywords({
  open,
  onClose,
  tracked,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  tracked: TrackedKeyword[];
  onAdd: (terms: string[]) => void;
}) {
  const [text, setText] = useState("");
  const have = new Set(tracked.map((k) => k.term));
  const typed = [...new Set(text.split(/[\n,]/).map(clean).filter(Boolean))];
  const fresh = typed.filter((t) => !have.has(t));
  const room = KEYWORD_LIMIT - tracked.length;
  const over = fresh.length > room;
  const ideas = keywordIdeas.filter(
    (i) => !have.has(i.term) && !typed.includes(i.term),
  );

  const close = () => {
    setText("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add keywords"
      width={560}
      footer={
        <>
          <p
            className={cn(
              "mr-auto self-center text-[12.5px]",
              over ? "text-bad" : "text-muted",
            )}
          >
            {over
              ? `Your plan has room for ${room} more. Remove ${fresh.length - room}.`
              : `${tracked.length + fresh.length} of ${KEYWORD_LIMIT} keywords on your plan`}
          </p>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={fresh.length === 0 || over}
            onClick={() => {
              onAdd(fresh);
              close();
            }}
          >
            {fresh.length
              ? `Track ${fresh.length} keyword${fresh.length > 1 ? "s" : ""}`
              : "Track"}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="text-[13px] font-medium">
          What would a customer type into Google?
        </span>
        <span className="block text-[12.5px] text-muted">
          One per line. Include the city or area when they would.
        </span>
        <Textarea
          autoFocus
          className="mt-2 w-full"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"root canal austin\ndentist open saturday"}
        />
      </label>

      {typed.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {typed.map((t) => (
            <li
              key={t}
              className="flex items-center justify-between gap-3 px-3 py-2 text-[13.5px]"
            >
              <span
                className={cn(
                  "min-w-0 truncate",
                  have.has(t) && "text-muted line-through",
                )}
              >
                {t}
              </span>
              <span className="num shrink-0 text-[12.5px] text-muted">
                {have.has(t)
                  ? "Already tracked"
                  : `${fmt(volumeOf(t))} searches / mo`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {ideas.length > 0 && (
        <div className="mt-5">
          <p className="text-[13px] font-medium">Ideas</p>
          <p className="text-[12.5px] text-muted">
            From your services and what competitors rank for. Click to add.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {ideas.map((i) => (
              <li key={i.term}>
                <button
                  onClick={() =>
                    setText(
                      (text.trim() ? text.replace(/\s+$/, "") + "\n" : "") +
                        i.term +
                        "\n",
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-3 pl-2 text-[13px] hover:border-line-strong hover:bg-hover"
                >
                  <Plus size={13} className="text-muted" />
                  {i.term}
                  <span className="num text-[12px] text-muted">
                    {fmt(i.volume)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-[12.5px] text-muted">
        Each keyword is checked every week: once on Google, and from{" "}
        {GRID_SPOTS} spots on the map. Searches a month come from the DataForSEO
        Keywords Data API.
      </p>
    </Modal>
  );
}
