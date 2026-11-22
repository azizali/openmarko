// What the Local SEO section costs in DataForSEO calls (#/local/costs). Change any setting or price on the left;
// the table on the right shows every call a Location makes in a month and what it costs. For the people building
// and pricing the product, not for business owners. The settings stay in this browser.

import { useEffect, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import {
  Button,
  Card,
  Checkbox,
  cn,
  fmt,
  Input,
  Select,
} from "../components/ui";
import {
  aiEngines,
  areas,
  defaultPrices,
  defaultSettings,
  frequencies,
  lineCost,
  queues,
  totals,
  type Frequency,
  type Prices,
  type Settings,
} from "../mock/costs";

const KEY = "gw-local-costs";

function load(): { s: Settings; p: Prices } {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved)
      return {
        s: { ...defaultSettings, ...saved.s },
        p: { ...defaultPrices, ...saved.p },
      };
  } catch {}
  return { s: defaultSettings, p: defaultPrices };
}

const usd = (x: number) =>
  x === 0
    ? "$0"
    : x < 0.01
      ? `$${x.toFixed(4)}`
      : x < 100
        ? `$${x.toFixed(2)}`
        : `$${Math.round(x).toLocaleString("en-US")}`;

function Num({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="min-w-0 text-[13px]">
        {label}
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
      <Input
        size="sm"
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="num w-24 shrink-0 text-right"
      />
    </label>
  );
}

function Every({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Frequency;
  onChange: (v: Frequency) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-[13px]">{label}</span>
      <Select
        size="sm"
        value={value}
        onChange={(e) => onChange(e.target.value as Frequency)}
        className="w-36 shrink-0"
      >
        {frequencies.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-3 first:border-0 first:pt-0">
      <p className="mb-1 text-[12.5px] font-medium text-muted">{title}</p>
      {children}
    </div>
  );
}

export function CostsPage() {
  const [{ s, p }, setState] = useState(load);
  const [showPrices, setShowPrices] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ s, p }));
    } catch {}
  }, [s, p]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setState((x) => ({ ...x, s: { ...x.s, [k]: v } }));
  const price = (patch: Partial<Prices>) =>
    setState((x) => ({ ...x, p: { ...x.p, ...patch } }));
  const t = totals(s, p);

  return (
    <>
      <p className="max-w-2xl text-[13.5px] text-muted">
        Every DataForSEO call behind these pages, and what it costs. Change a
        setting or a price and the table follows. Prices are DataForSEO's,
        before any markup, as OpenSEO meters them (read September 2026).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Per location, per month", value: usd(t.perLocation) },
          {
            label: `All ${s.locations} location${s.locations > 1 ? "s" : ""}, per month`,
            value: usd(t.perMonth),
          },
          { label: "Per year", value: usd(t.perYear) },
          { label: "Calls per month", value: fmt(Math.round(t.calls)) },
        ].map((x) => (
          <div key={x.label} className="bg-surface p-4">
            <p className="text-[12.5px] text-muted">{x.label}</p>
            <p className="num mt-1 font-serif text-[26px] leading-none">
              {x.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <Card className="space-y-3 self-start">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-medium">Settings</p>
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw size={12} />}
              onClick={() => setState({ s: defaultSettings, p: defaultPrices })}
            >
              Reset
            </Button>
          </div>
          <Group title="Business">
            <Num
              label="Locations"
              value={s.locations}
              onChange={(v) => set("locations", v)}
              min={1}
            />
          </Group>
          <Group title="Google Maps">
            <Num
              label="Keywords"
              value={s.keywords}
              onChange={(v) => set("keywords", v)}
            />
            <label className="flex items-center justify-between gap-3 py-1">
              <span className="text-[13px]">Grid</span>
              <Select
                size="sm"
                value={s.gridSize}
                onChange={(e) => set("gridSize", Number(e.target.value))}
                className="w-36 shrink-0"
              >
                {[3, 5, 7, 9, 11, 13, 15].map((g) => (
                  <option key={g} value={g}>
                    {g} × {g} ({g * g} spots)
                  </option>
                ))}
              </Select>
            </label>
            <Every
              label="Scan"
              value={s.mapsEvery}
              onChange={(v) => set("mapsEvery", v)}
            />
            <label className="flex items-center justify-between gap-3 py-1">
              <span className="min-w-0 text-[13px]">
                Queue
                <span className="block text-[12px] text-muted">
                  {queues.find((q) => q.id === s.mapsQueue)!.wait}
                </span>
              </span>
              <Select
                size="sm"
                value={s.mapsQueue}
                onChange={(e) =>
                  set("mapsQueue", e.target.value as Settings["mapsQueue"])
                }
                className="w-36 shrink-0"
              >
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </Select>
            </label>
          </Group>
          <Group title="Google search (same keywords)">
            <Every
              label="Check"
              value={s.organicEvery}
              onChange={(v) => set("organicEvery", v)}
            />
            <label className="flex items-center justify-between gap-3 py-1">
              <span className="text-[13px]">Read</span>
              <Select
                size="sm"
                value={s.organicDepth}
                onChange={(e) => set("organicDepth", Number(e.target.value))}
                className="w-36 shrink-0"
              >
                {[10, 20, 50, 100].map((d) => (
                  <option key={d} value={d}>
                    Top {d}
                  </option>
                ))}
              </Select>
            </label>
          </Group>
          <Group title="AI answers">
            <Num
              label="Questions"
              value={s.questions}
              onChange={(v) => set("questions", v)}
            />
            <Num
              label="Places asked from"
              hint="1 is your address; more is an AI grid"
              value={s.aiPlaces}
              onChange={(v) => set("aiPlaces", v)}
              min={1}
            />
            <Every
              label="Check"
              value={s.aiEvery}
              onChange={(v) => set("aiEvery", v)}
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
              {aiEngines.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 text-[13px]"
                  title={e.how}
                >
                  <Checkbox
                    checked={s.engines.includes(e.id)}
                    onChange={(on) =>
                      set(
                        "engines",
                        on
                          ? [...s.engines, e.id]
                          : s.engines.filter((x) => x !== e.id),
                      )
                    }
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </Group>
          <Group title="Competitors">
            <Num
              label="Profiles compared"
              value={s.competitorProfiles}
              onChange={(v) => set("competitorProfiles", v)}
            />
            <Every
              label="Refresh profiles"
              value={s.profilesEvery}
              onChange={(v) => set("profilesEvery", v)}
            />
            <Num
              label="Websites studied"
              value={s.competitorSites}
              onChange={(v) => set("competitorSites", v)}
            />
            <Num
              label="Keywords read per website"
              value={s.rankedRows}
              onChange={(v) => set("rankedRows", v)}
              step={50}
            />
          </Group>
          <Group title="Keyword research (monthly)">
            <Num
              label="Idea requests"
              value={s.ideaRequests}
              onChange={(v) => set("ideaRequests", v)}
            />
            <Num
              label="Ideas per request"
              value={s.ideaRows}
              onChange={(v) => set("ideaRows", v)}
              step={50}
            />
          </Group>
          <Group title="Prices">
            <button
              onClick={() => setShowPrices(!showPrices)}
              className="text-[13px] text-muted underline underline-offset-2 hover:text-fg"
            >
              {showPrices ? "Hide prices" : "Change prices"}
            </button>
            {showPrices && (
              <div className="mt-2">
                {queues.map((q) => (
                  <Num
                    key={q.id}
                    label={`Maps spot, ${q.label.toLowerCase()}`}
                    value={p.maps[q.id]}
                    step={0.0001}
                    onChange={(v) => price({ maps: { ...p.maps, [q.id]: v } })}
                  />
                ))}
                <Num
                  label="Google, first 10 results"
                  value={p.organicFirstPage}
                  step={0.0001}
                  onChange={(v) => price({ organicFirstPage: v })}
                />
                <Num
                  label="Google, each 10 after"
                  value={p.organicNextPage}
                  step={0.0001}
                  onChange={(v) => price({ organicNextPage: v })}
                />
                {aiEngines.map((e) => (
                  <Num
                    key={e.id}
                    label={`${e.label} answer`}
                    value={p.ai[e.id]}
                    step={0.0001}
                    onChange={(v) => price({ ai: { ...p.ai, [e.id]: v } })}
                  />
                ))}
                <Num
                  label="Google profile"
                  value={p.profile}
                  step={0.0001}
                  onChange={(v) => price({ profile: v })}
                />
                <Num
                  label="Labs request"
                  value={p.labsTask}
                  step={0.001}
                  onChange={(v) => price({ labsTask: v })}
                />
                <Num
                  label="Labs row"
                  value={p.labsRow}
                  step={0.00001}
                  onChange={(v) => price({ labsRow: v })}
                />
                <Num
                  label="Search volume request"
                  value={p.searchVolume}
                  step={0.01}
                  onChange={(v) => price({ searchVolume: v })}
                />
              </div>
            )}
          </Group>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card pad={false} className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th className="py-2.5 pl-4 font-normal">
                    One location, one month
                  </th>
                  <th className="px-3 py-2.5 text-right font-normal">Calls</th>
                  <th className="px-3 py-2.5 text-right font-normal">Each</th>
                  <th className="py-2.5 pr-4 text-right font-normal">Cost</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => {
                  const rows = t.lines.filter((l) => l.area === a.id);
                  if (!rows.length) return null;
                  return [
                    <tr key={a.id} className="border-b border-line bg-hover/60">
                      <td className="py-2 pl-4 font-medium">{a.label}</td>
                      <td colSpan={2} />
                      <td className="num py-2 pr-4 text-right font-medium">
                        {usd(t.byArea[a.id])}
                      </td>
                    </tr>,
                    ...rows.map((l) => (
                      <tr key={a.id + l.what} className="border-b border-line">
                        <td className="py-2.5 pl-4">
                          <span className={cn(l.free && "text-muted")}>
                            {l.what}
                          </span>
                          <span className="block text-[12px] text-muted">
                            {l.free ? `${l.how}. ${l.free}.` : l.how}
                          </span>
                          {!l.free && (
                            <span className="block font-mono text-[11px] text-subtle">
                              {l.endpoint}
                            </span>
                          )}
                        </td>
                        <td className="num px-3 py-2.5 text-right">
                          {l.free ? "–" : fmt(Math.round(l.calls))}
                        </td>
                        <td className="num px-3 py-2.5 text-right text-muted">
                          {l.free ? "–" : usd(l.unit)}
                        </td>
                        <td className="num py-2.5 pr-4 text-right">
                          {l.free ? "$0" : usd(lineCost(l))}
                        </td>
                      </tr>
                    )),
                  ];
                })}
                <tr>
                  <td className="py-3 pl-4 font-medium">Total per location</td>
                  <td colSpan={2} />
                  <td className="num py-3 pr-4 text-right font-medium">
                    {usd(t.perLocation)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card>
            <p className="text-[14px] font-medium">Reading it</p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
              <li>
                The map grid is{" "}
                {Math.round(
                  (t.byArea.maps / Math.max(t.perLocation, 1e-9)) * 100,
                )}
                % of the bill. Grid size and how often you scan move the total
                most: a {s.gridSize}×{s.gridSize} grid is{" "}
                {s.gridSize * s.gridSize} calls per keyword per scan.
              </li>
              <li>
                Each tracked keyword costs {usd(t.perKeyword)} a month (map and
                Google together).
              </li>
              <li>
                Competitors are nearly free: who ranks where comes with your own
                results. Only their profile facts and the keywords their
                websites rank for are separate calls.
              </li>
              <li>
                Perplexity and Claude answers are priced by tokens, so they cost
                30 to 150 times a ChatGPT or Google answer.
              </li>
              <li>
                Not included: the AI model that writes suggestions and posts,
                Google's own APIs (free), and any markup you add.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
