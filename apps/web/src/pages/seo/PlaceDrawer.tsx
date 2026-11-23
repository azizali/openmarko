// One business up close, opened from a Google Maps leaderboard: its profile, when its reviews come in, its rating
// over 90 days, the categories it lists that you don't, and where it stands on each of your Maps keywords.
import type { ReactNode } from "react";
import { ExternalLink, MapPin, Phone, Star } from "lucide-react";
import { Badge, Button, Drawer, Sparkline, cn, fmt } from "../../components/ui";
import { LoadError } from "../../components/Feedback";
import { useLoad } from "../../lib/useLoad";
import { locationApi, type PlaceInsight } from "./api";
import { useSeo } from "./Seo";

export function PlaceDrawer({
  placeId,
  onClose,
  onShowMap,
}: {
  placeId: string | null;
  onClose: () => void;
  /** Shows this business's map on the page, when the page has one. */
  onShowMap?: (placeId: string) => void;
}) {
  const { orgId, location } = useSeo();
  const page = useLoad(
    () => (placeId ? locationApi(orgId, location.id).places({ placeId }).get() : Promise.resolve({ data: null, error: null })),
    [orgId, location.id, placeId],
  );
  const p = page.data && page.data.id === placeId ? page.data : null;
  return (
    <Drawer
      open={!!placeId}
      onClose={onClose}
      width={520}
      title={p ? (p.isYou ? `${p.name} (you)` : p.name) : "Business"}
      footer={
        p &&
        onShowMap && (
          <Button
            icon={<MapPin size={14} />}
            onClick={() => {
              onShowMap(p.id);
              onClose();
            }}
          >
            {p.isYou ? "Show your map" : "Show their map"}
          </Button>
        )
      }
    >
      {page.error ? (
        <LoadError what="this business">{page.error}</LoadError>
      ) : p ? (
        <Body p={p} />
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </Drawer>
  );
}

function Body({ p }: { p: PlaceInsight }) {
  const mine = new Set(p.yourCategories.map((c) => c.toLowerCase()));
  const extra = p.isYou ? [] : p.categories.filter((c) => !mine.has(c.toLowerCase()));
  return (
    <div className="space-y-7">
      <div>
        <p className="text-[13.5px]">
          {p.category ?? "No category"}
          {p.distanceMi !== null && !p.isYou && <span className="text-muted"> · {p.distanceMi} mi from you</span>}
        </p>
        {p.address && <p className="mt-0.5 text-[12.5px] text-muted">{p.address}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          {p.isClaimed !== null && <Badge tone={p.isClaimed ? "good" : "warn"}>{p.isClaimed ? "Claimed" : "Unclaimed"}</Badge>}
          <Ext href={p.mapsUrl}>Google Maps</Ext>
          {p.website && <Ext href={`https://${p.website}`}>{p.website}</Ext>}
          {p.phone && (
            <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 text-muted hover:text-fg">
              <Phone size={12} aria-hidden /> {p.phone}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Fig label="Rating">
          {p.rating === null ? (
            "—"
          ) : (
            <span className="inline-flex items-center gap-1">
              {p.rating.toFixed(1)} <Star size={15} className="fill-warn text-warn" aria-hidden />
            </span>
          )}
        </Fig>
        <Fig label="Reviews">{p.reviews === null ? "—" : fmt(p.reviews)}</Fig>
        <Fig label="New, 30 days">{p.newReviewsPerMonth === null ? "—" : `+${fmt(p.newReviewsPerMonth)}`}</Fig>
      </div>

      <Section title="New reviews per week" note="last 13 weeks">
        <WeekBars labels={p.history.labels} values={p.history.newReviews} />
        {p.trackedSince && <p className="mt-1.5 text-[12px] text-muted">Tracked since {day(p.trackedSince)}.</p>}
      </Section>

      <RatingTrend values={p.history.rating} />

      {p.categories.length > 0 && (
        <Section title="Categories" note={extra.length ? `${extra.length} you don't list` : undefined}>
          <div className="flex flex-wrap gap-1.5">
            {p.categories.map((c) => {
              const missing = extra.includes(c);
              return (
                <Badge key={c} tone={missing ? "accent" : "neutral"}>
                  {c}
                  {missing && <span className="sr-only"> (you don't list this)</span>}
                </Badge>
              );
            })}
          </div>
          {extra.length > 0 && <p className="mt-1.5 text-[12px] text-muted">Highlighted: not on your profile.</p>}
        </Section>
      )}

      {p.keywords.length > 0 && (
        <Section title="On your keywords" note="top-3 spots">
          <ul className="divide-y divide-line">
            {p.keywords.map((k) => (
              <li key={k.keywordId} className="flex items-center gap-3 py-2 text-[13.5px]">
                <span className="num w-7 shrink-0 text-muted">{k.rank === null ? "—" : `#${k.rank}`}</span>
                <span className="min-w-0 flex-1 truncate">{k.term}</span>
                <span className="num shrink-0">
                  {k.top3}
                  {!p.isYou && (
                    <span className={cn("text-[12.5px]", k.top3 > k.yourTop3 ? "text-bad" : "text-muted")}> vs your {k.yourTop3}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg">
      {children} <ExternalLink size={12} aria-hidden />
    </a>
  );
}

function Fig({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="num mt-0.5 font-serif text-[24px] leading-tight">{children}</p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-medium">
        {title}
        {note && <span className="font-normal text-muted"> · {note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** A bar per week; a week without two readings to compare is a gap, not a zero. */
function WeekBars({ labels, values }: { labels: string[]; values: (number | null)[] }) {
  const known = values.filter((v): v is number => v !== null);
  if (!known.length) return <p className="text-[13px] text-muted">Shows after two weeks of checks.</p>;
  const max = Math.max(1, ...known);
  return (
    <div>
      <div className="flex h-20 items-end gap-1" role="img" aria-label={`New reviews per week: ${known.join(", ")}`}>
        {values.map((v, i) => (
          <div key={labels[i]} className="flex h-full flex-1 flex-col justify-end" title={`Week of ${labels[i]}: ${v ?? "no data"}`}>
            {v === null ? (
              <div className="h-px bg-line" />
            ) : (
              <div className={cn("rounded-sm", v ? "bg-accent" : "bg-line-strong")} style={{ height: v ? `${(v / max) * 100}%` : 2 }} />
            )}
          </div>
        ))}
      </div>
      <div className="num mt-1 flex justify-between text-[11px] text-subtle">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

function RatingTrend({ values }: { values: (number | null)[] }) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const first = known[0]!;
  const last = known[known.length - 1]!;
  return (
    <Section title="Rating, 90 days">
      <div className="flex items-center gap-3">
        <Sparkline data={values} width={160} height={28} />
        <span className="num text-[13.5px]">
          {first.toFixed(1)} → {last.toFixed(1)}
        </span>
      </div>
    </Section>
  );
}
