// The app in a window, in the home hero: its sidebar picks one of four pages, three headline numbers sit above
// each page, and each page shows what it shows in the product, for one example practice.
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Minus, Settings, Users } from "lucide-react";
import { cn } from "../ui";
import { GridThumb } from "./MapGrid";
import { business, competitors, engines, gridRanks, mapsKeywords, searchKeywords, top3 } from "./mock";

const brand = (src: string, ink = false) => (
  <img src={src} alt="" width={16} height={16} className={cn("size-4 object-contain", ink && "dark:invert")} />
);
const pages = [
  { id: "maps", label: "Google Maps", icon: brand("/icons/google-maps.svg") },
  { id: "search", label: "Google search", icon: brand("/icons/google-icon.svg") },
  { id: "ai", label: "AI answers", icon: brand("/icons/openai.svg", true) },
  { id: "competitors", label: "Competitors", icon: <Users size={16} /> },
] as const;
type PageId = (typeof pages)[number]["id"];

function Change({ by }: { by: number }) {
  if (!by)
    return (
      <span className="inline-flex items-center gap-0.5 text-subtle">
        <Minus size={13} />0
      </span>
    );
  const up = by > 0;
  return (
    <span className={cn("num inline-flex items-center gap-0.5", up ? "text-good" : "text-bad")}>
      {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
      {Math.abs(by)}
    </span>
  );
}

/** A table from the app. Columns named in `wide` show from 640px up, so a phone keeps the ones that matter. */
function Table({ head, wide = [], children }: { head: string[]; wide?: number[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-muted">
            {head.map((h, i) => (
              <th key={h} className={cn("py-2 font-normal", i > 0 && "pl-3 text-right", wide.includes(i) && "hidden sm:table-cell")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function MapsPage() {
  return (
    <Table head={["Keyword", "Top 3 spots", "Grid", "30 days"]}>
      {mapsKeywords.map((k) => {
        const ranks = gridRanks(7, k.seed);
        return (
          <tr key={k.keyword}>
            <td className="py-3">{k.keyword}</td>
            <td className="num py-3 text-right">
              {top3(ranks)}
              <span className="text-muted">/49</span>
            </td>
            <td className="py-3">
              <div className="flex justify-end">
                <GridThumb size={7} ranks={ranks} px={53} />
              </div>
            </td>
            <td className="py-3 text-right">
              <Change by={k.change} />
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function SearchPage() {
  const yes = (on: boolean) =>
    on ? (
      <Check size={15} className="ml-auto text-good" aria-label="Yes" />
    ) : (
      <Minus size={15} className="ml-auto text-subtle" aria-label="No" />
    );
  return (
    <Table head={["Keyword", "Position", "30 days", "Map pack", "AI Overview"]} wide={[3, 4]}>
      {searchKeywords.map((k) => (
        <tr key={k.keyword}>
          <td className="py-3">{k.keyword}</td>
          <td className="num py-3 text-right font-medium">#{k.position}</td>
          <td className="py-3 text-right">
            <Change by={k.change} />
          </td>
          <td className="hidden py-3 text-right sm:table-cell">{yes(k.pack)}</td>
          <td className="hidden py-3 text-right sm:table-cell">{yes(k.overview)}</td>
        </tr>
      ))}
    </Table>
  );
}

const answers = {
  chatgpt: {
    named: 2,
    text: (
      <>
        For South Congress, patients often mention Congress Ave Dental and{" "}
        <mark className="bg-accent-soft px-0.5 text-fg">Bright Smile Dental</mark>, which has same-day emergency visits…
      </>
    ),
    cites: "Yelp, Google reviews",
  },
  overview: {
    named: 1,
    text: (
      <>
        <mark className="bg-accent-soft px-0.5 text-fg">Bright Smile Dental</mark> on South Congress Ave is rated 4.8 from 240 reviews and
        offers Invisalign and whitening…
      </>
    ),
    cites: "Google Business Profile",
  },
  perplexity: {
    named: null,
    text: <>Top-rated options near South Congress include Congress Ave Dental, Bouldin Creek Smiles and SoCo Family Dentistry…</>,
    cites: "Healthgrades, Zocdoc",
  },
} as const;

function AiPage() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Question: <span className="text-fg">Who is the best dentist in South Congress, Austin?</span>
      </p>
      <ul className="grid gap-3 md:grid-cols-3">
        {engines.map((e) => {
          const a = answers[e.id];
          return (
            <li key={e.id} className="flex flex-col gap-2.5 rounded-xl border border-line p-3.5">
              <div className="flex items-center gap-2 text-[13.5px] font-medium">
                <img src={e.icon} alt="" width={18} height={18} className={cn("size-[18px]", e.ink && "dark:invert")} />
                {e.name}
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[11.5px]",
                    a.named ? "bg-good-soft text-good" : "bg-bad-soft text-bad",
                  )}
                >
                  {a.named ? `Named #${a.named}` : "Not named"}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-fg/80">{a.text}</p>
              <p className="mt-auto text-[12px] text-muted">Cited: {a.cites}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompetitorsPage() {
  return (
    <Table head={["Business", "Ahead of you on", "Rating", "Reviews"]} wide={[2]}>
      {competitors.map((c) => (
        <tr key={c.name}>
          <td className="py-3">{c.name}</td>
          <td className="py-3">
            <div className="flex items-center justify-end gap-2">
              <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-sunken sm:block">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(c.ahead / 12) * 100}%` }} />
              </span>
              <span className="num text-right whitespace-nowrap">{c.ahead} of 12</span>
            </div>
          </td>
          <td className="num hidden py-3 text-right sm:table-cell">{c.rating}</td>
          <td className="num py-3 text-right">{c.reviews}</td>
        </tr>
      ))}
    </Table>
  );
}

const titles: Record<PageId, { title: string; checked: string; body: () => ReactNode }> = {
  maps: { title: "Google Maps", checked: "Checked Monday · 7 × 7 grid, 2 miles", body: MapsPage },
  search: { title: "Google search", checked: "Checked Monday · 5 keywords", body: SearchPage },
  ai: { title: "AI answers", checked: "Checked Monday · 3 assistants", body: AiPage },
  competitors: { title: "Competitors", checked: "Checked Monday · 4 nearby", body: CompetitorsPage },
};

/** The three numbers at the top of every page: the week at a glance. */
const glance = [
  { label: "Top 3 spots", value: "21", of: "/49", note: "↑ 12 since you started", good: true },
  { label: "Named by AI", value: "4", of: "/6 questions", note: "↑ 3 this month", good: true },
  { label: "This week's fixes", value: "3", of: "", note: "Ready to apply", good: false },
];

export function AppShowcase() {
  const [page, setPage] = useState<PageId>("maps");
  const t = titles[page];
  const Body = t.body;
  const tab = (p: (typeof pages)[number], side: boolean) => (
    <button
      key={p.id}
      role="tab"
      aria-selected={page === p.id}
      onClick={() => setPage(p.id)}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md px-2.5 text-left transition-colors",
        side ? "py-2" : "min-h-11 py-2",
        page === p.id ? "bg-surface font-medium text-fg shadow-card ring-1 ring-line" : "text-muted hover:text-fg",
      )}
    >
      {p.icon}
      {p.label}
    </button>
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-[0_1px_2px_rgb(9_9_11/0.05),0_30px_80px_-20px_rgb(219_39_119/0.22)] dark:shadow-float">
      <div className="grid md:grid-cols-[210px_1fr]">
        <aside className="hidden flex-col gap-0.5 border-r border-line bg-sunken p-3 text-[13.5px] md:flex">
          <div className="mb-3 flex items-center gap-2.5 px-2 pt-1.5 pb-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-[13px] font-semibold text-accent-ink">
              {business.name[0]}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-medium">{business.name}</span>
              <span className="block truncate text-[11.5px] text-muted">{business.area}</span>
            </span>
          </div>
          <div role="tablist" aria-label="Pages in the app" aria-orientation="vertical" className="flex flex-col gap-0.5">
            {pages.map((p) => tab(p, true))}
          </div>
          <span className="mt-0.5 flex items-center gap-2 px-2.5 py-2 text-muted">
            <Settings size={16} />
            Settings
          </span>
        </aside>
        <div className="flex min-w-0 flex-col">
          {/* On a phone the sidebar's pages become a row of tabs across the top. */}
          <div
            role="tablist"
            aria-label="Pages in the app"
            className="flex gap-1 overflow-x-auto border-b border-line bg-sunken p-2 text-[13.5px] md:hidden"
          >
            {pages.map((p) => tab(p, false))}
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-[15px] font-semibold">{t.title}</h2>
            <span className="truncate text-[12.5px] text-muted">{t.checked}</span>
          </div>
          <div role="tabpanel" className="flex min-w-0 flex-col gap-4 px-4 pt-4 pb-5 sm:px-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {glance.map((g, i) => (
                <div
                  key={g.label}
                  className={cn("flex flex-col gap-1 rounded-xl border border-line px-3.5 py-3", i === 2 && "hidden sm:flex")}
                >
                  <span className="text-[12px] text-muted">{g.label}</span>
                  <span className="num font-display text-[24px] leading-tight">
                    {g.value}
                    <span className="text-[13px] font-medium tracking-normal text-muted">{g.of}</span>
                  </span>
                  <span className={cn("text-[12px]", g.good ? "text-good" : "text-muted")}>{g.note}</span>
                </div>
              ))}
            </div>
            <div key={page} className="rise">
              <Body />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
