// Dev server only: a small panel to try heading typefaces on the live page. It sets html[data-heading] (styled in
// index.css) and loads that face from Google Fonts on first pick; `?font=<id>` in the address picks one too. The choice is remembered on this browser only.
// Once one is chosen, make it the default in index.css and index.html, and remove this component.
import { useEffect, useState } from "react";
import { Type, X } from "lucide-react";
import { cn } from "./ui";

const options = [
  { id: "archivo", name: "Archivo Condensed", note: "Current: loud, tight, poster-like", css: null },
  { id: "frank", name: "Frank Ruhl Libre", note: "Classic serif, closest to Origami", css: null },
  { id: "instrument", name: "Instrument Serif", note: "Editorial, elegant, high contrast", css: "Instrument+Serif:ital@0;1" },
  { id: "fraunces", name: "Fraunces", note: "Soft serif, warm and local", css: "Fraunces:opsz,wght,SOFT,WONK@9..144,400..700,0..100,0..1" },
  { id: "geist", name: "Geist", note: "Neutral, precise software look", css: "Geist:wght@500..700" },
  {
    id: "bricolage",
    name: "Bricolage Grotesque",
    note: "Friendly grotesque with character",
    css: "Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,600..800",
  },
] as const;
type Option = (typeof options)[number]["id"];

const KEY = "site-heading-font";

function load(id: Option) {
  const css = options.find((o) => o.id === id)?.css;
  if (!css || document.getElementById(`font-${id}`)) return;
  const link = document.createElement("link");
  link.id = `font-${id}`;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${css}&display=swap`;
  document.head.append(link);
}

function apply(id: Option) {
  load(id);
  if (id === "archivo") delete document.documentElement.dataset.heading;
  else document.documentElement.dataset.heading = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: this visit only
  }
}

export function FontPicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Option>(() => {
    // ?font=fraunces in the address picks one directly, so an option can be shared as a link.
    const fromUrl = new URLSearchParams(window.location.search).get("font");
    if (options.some((o) => o.id === fromUrl)) return fromUrl as Option;
    try {
      return (localStorage.getItem(KEY) as Option | null) ?? "archivo";
    } catch {
      return "archivo";
    }
  });
  useEffect(() => apply(current), [current]);

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div role="dialog" aria-label="Heading typeface" className="w-[290px] rounded-xl border border-line bg-surface p-2 shadow-float">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <span className="text-[13px] font-medium">Heading typeface</span>
            <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">Dev only</span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {options.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => setCurrent(o.id)}
                  aria-pressed={current === o.id}
                  className={cn(
                    "flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left transition-colors",
                    current === o.id ? "bg-ink text-on-ink" : "hover:bg-hover",
                  )}
                >
                  <span className="text-[14px] font-medium">{o.name}</span>
                  <span className={cn("text-[12px]", current === o.id ? "text-on-ink/70" : "text-muted")}>{o.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close the typeface picker" : "Try heading typefaces"}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-medium text-on-ink shadow-float transition-transform active:scale-[0.97]"
      >
        {open ? <X size={16} /> : <Type size={16} />}
        {open ? "Close" : "Fonts"}
      </button>
    </div>
  );
}
