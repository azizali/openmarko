// One business up close (/seo/maps/places/<placeId>), opened from a keyword's leaderboard: its profile, when its
// reviews come in, its rating over 90 days, the categories it lists that you don't, and where it stands on each of
// your Maps keywords. `?keyword=` is the keyword it was opened from, for the breadcrumbs back; each keyword row opens
// that keyword's map drawn for this business.
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronRight, ExternalLink, Phone, Star } from "lucide-react";
import { Badge, Card, Sparkline, cn, fmt, type Crumb } from "../../components/ui";
import { LoadError } from "../../components/Feedback";
import { useLoad } from "../../lib/useLoad";
import { locationApi, type PlaceInsight } from "./api";
import { SeoHeader, useSeo, useSeoHref } from "./Seo";
import { MapsSource } from "./MapsKeyword";
import { WeekBars } from "./parts";

export default function Place({ placeId }: { placeId: string }) {
  const { orgId, location } = useSeo();
  const [params] = useSearchParams();
  const href = useSeoHref();
  const page = useLoad(() => locationApi(orgId, location.id).places({ placeId }).get(), [orgId, location.id, placeId]);
  const p = page.data;
  const from = params.get("keyword");
  const via = p?.keywords.find((k) => k.keywordId === from);
  const name = p ? (p.isYou ? `${p.name} (you)` : p.name) : "Business";
  const trail: Crumb[] = [...(via ? [{ label: via.term, to: href(`/seo/maps/${via.keywordId}`) }] : []), { label: name }];

  return (
    <>
      <SeoHeader
        tab="maps"
        title={name}
        trail={trail}
        switcher={false}
        sub={
          p ? (
            <>
              {p.category ?? "No category"}
              {p.distanceMi !== null && !p.isYou && ` · ${p.distanceMi} mi from you`}
            </>
          ) : (
            ""
          )
        }
      />
      {page.error ? <LoadError what="this business">{page.error}</LoadError> : p && <Body p={p} />}
      <MapsSource />
    </>
  );
}

function Body({ p }: { p: PlaceInsight }) {
  const href = useSeoHref();
  const mine = new Set(p.yourCategories.map((c) => c.toLowerCase()));
  const extra = p.isYou ? [] : p.categories.filter((c) => !mine.has(c.toLowerCase()));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card className="space-y-5">
          <div>
            {p.address && <p className="text-[13.5px]">{p.address}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
              {p.isClaimed !== null && <Badge tone={p.isClaimed ? "good" : "warn"}>{p.isClaimed ? "Claimed" : "Unclaimed"}</Badge>}
              <Ext href={p.mapsUrl}>Google Maps</Ext>
              {p.website && <Ext href={`https://${p.website}`}>{p.website}</Ext>}
              {p.phone && (
                <span className="inline-flex items-center gap-1 text-muted select-all">
                  <Phone size={12} aria-hidden /> {p.phone}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 border-t border-line pt-4">
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
        </Card>

        <Card>
          <Section title="New reviews per week" note="last 13 weeks">
            <WeekBars labels={p.history.labels} values={p.history.newReviews} label="New reviews" />
            {p.trackedSince && <p className="mt-1.5 text-[12px] text-muted">Tracked since {day(p.trackedSince)}.</p>}
          </Section>
          <RatingTrend values={p.history.rating} />
        </Card>

        {p.categories.length > 0 && (
          <Card>
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
          </Card>
        )}
      </div>

      <Card pad={false} className="self-start">
        <div className="px-4 pt-4">
          <Section title="On your keywords" note={p.isYou ? "top-3 spots" : "top-3 spots, theirs vs yours"}>
            {p.keywords.length === 0 && <p className="pb-4 text-[13px] text-muted">Not seen on any of your Maps keywords yet.</p>}
          </Section>
        </div>
        {p.keywords.length > 0 && (
          <ul className="divide-y divide-line">
            {p.keywords.map((k) => (
              <li key={k.keywordId}>
                <Link
                  to={href(`/seo/maps/${k.keywordId}${p.isYou ? "" : `?who=${p.id}`}`)}
                  className="group flex items-center gap-3 px-4 py-2.5 text-[13.5px] hover:bg-hover"
                >
                  <span className="num w-7 shrink-0 text-muted">{k.rank === null ? "—" : `#${k.rank}`}</span>
                  <span className="min-w-0 flex-1 truncate">{k.term}</span>
                  <span className="num shrink-0">
                    {k.top3}
                    <span className="text-muted">/{k.spots}</span>
                    {!p.isYou && (
                      <span className={cn("text-[12.5px]", k.top3 > k.yourTop3 ? "text-bad" : "text-muted")}> vs your {k.yourTop3}</span>
                    )}
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-subtle group-hover:text-fg" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {p.keywords.length > 0 && !p.isYou && <p className="px-4 py-3 text-[12px] text-muted">Open a keyword to see their map.</p>}
      </Card>
    </div>
  );
}

const day = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

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
      <h2 className="mb-2 text-[14px] font-medium">
        {title}
        {note && <span className="font-normal text-muted"> · {note}</span>}
      </h2>
      {children}
    </section>
  );
}

function RatingTrend({ values }: { values: (number | null)[] }) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const first = known[0]!;
  const last = known[known.length - 1]!;
  return (
    <div className="mt-6">
      <Section title="Rating, 90 days">
        <div className="flex items-center gap-3">
          <Sparkline data={values} width={160} height={28} />
          <span className="num text-[13.5px]">
            {first.toFixed(1)} → {last.toFixed(1)}
          </span>
        </div>
      </Section>
    </div>
  );
}
