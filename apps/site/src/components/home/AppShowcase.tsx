// The app in a window: its sidebar and four of its pages, picked with the tabs above. Each page shows what it shows
// in the product, with the same practice and the same numbers as the hero's tile.
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Gauge, LayoutGrid, MapPin, Minus, Search, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "../ui";
import { GridThumb } from "./MapGrid";
import { business, competitors, engines, gridRanks, mapsKeywords, searchKeywords, top3 } from "./mock";

const pages = [
  { id: "maps", label: "Google Maps", icon: MapPin },
  { id: "search", label: "Google search", icon: Search },
  { id: "ai", label: "AI answers", icon: Sparkles },
  { id: "competitors", label: "Competitors", icon: Users },
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
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-muted">
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
            <td className="py-2.5">{k.keyword}</td>
            <td className="num py-2.5 text-right">
              {top3(ranks)}
              <span className="text-muted">/49</span>
            </td>
            <td className="py-2.5">
              <div className="flex justify-end">
                <GridThumb size={7} ranks={ranks} px={40} />
              </div>
            </td>
            <td className="py-2.5 text-right">
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
          <td className="py-2.5">{k.keyword}</td>
          <td className="num py-2.5 text-right font-medium">#{k.position}</td>
          <td className="py-2.5 text-right">
            <Change by={k.change} />
          </td>
          <td className="hidden py-2.5 text-right sm:table-cell">{yes(k.pack)}</td>
          <td className="hidden py-2.5 text-right sm:table-cell">{yes(k.overview)}</td>
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
          <td className="py-2.5">{c.name}</td>
          <td className="py-2.5">
            <div className="flex items-center justify-end gap-2">
              <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-sunken sm:block">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(c.ahead / 12) * 100}%` }} />
              </span>
              <span className="num text-right whitespace-nowrap">{c.ahead} of 12</span>
            </div>
          </td>
          <td className="num hidden py-2.5 text-right sm:table-cell">{c.rating}</td>
          <td className="num py-2.5 text-right">{c.reviews}</td>
        </tr>
      ))}
    </Table>
  );
}

const titles: Record<PageId, { title: string; sub: string; body: () => ReactNode }> = {
  maps: { title: "Google Maps ranking", sub: "Your position from 49 spots around the practice, per keyword.", body: MapsPage },
  search: { title: "Keywords", sub: "Where you sit on Google's first page, the map pack and the AI Overview.", body: SearchPage },
  ai: { title: "AI answers", sub: "Whether each assistant names you, what it says, and what it read.", body: AiPage },
  competitors: { title: "Competitors", sub: "Who beats you, on how many keywords, and what their profile has.", body: CompetitorsPage },
};

export function AppShowcase() {
  const [page, setPage] = useState<PageId>("maps");
  const t = titles[page];
  const Body = t.body;
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Pages in the app" className="flex flex-wrap gap-1.5">
        {pages.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={page === p.id}
            onClick={() => setPage(p.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-[14px] transition-colors active:scale-[0.98]",
              page === p.id ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            <p.icon size={15} />
            {p.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
        <div className="grid md:grid-cols-[210px_1fr]">
          <aside className="hidden flex-col gap-0.5 border-r border-line bg-sunken p-3 text-[13.5px] md:flex">
            <div className="mb-3 rounded-lg border border-line bg-surface px-3 py-2">
              <div className="truncate font-medium">{business.name}</div>
              <div className="truncate text-[12px] text-muted">{business.area}</div>
            </div>
            {[{ id: "overview", label: "Overview", icon: Gauge }, ...pages, { id: "settings", label: "Settings", icon: Settings }].map(
              (p) => (
                <span
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5",
                    p.id === page ? "bg-surface font-medium text-fg shadow-card" : "text-muted",
                  )}
                >
                  <p.icon size={15} />
                  {p.label}
                </span>
              ),
            )}
          </aside>
          <div role="tabpanel" className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-[18px] font-medium">
                  <LayoutGrid size={17} className="text-accent" />
                  {t.title}
                </h3>
                <p className="text-[13.5px] text-muted">{t.sub}</p>
              </div>
              <span className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-muted">Checked Monday · weekly</span>
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
