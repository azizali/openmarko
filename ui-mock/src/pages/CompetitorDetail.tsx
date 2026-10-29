import { Link, useParams } from "react-router";
import { ChevronRight, ExternalLink, Check, X as XIcon, Wand2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, cn, fmt } from "../components/ui";
import { competitors, keywords } from "../data/mock";

export default function CompetitorDetail() {
  const { id } = useParams();
  const c = competitors.find((x) => x.id === id && !x.isYou) ?? competitors[1];
  const you = competitors.find((x) => x.isYou)!;
  const missingCats = c.categories.filter((cat) => !you.categories.includes(cat));

  const rows: [string, number, number, boolean][] = [
    ["Rating", you.rating, c.rating, false],
    ["Reviews", you.reviews, c.reviews, false],
    ["Reviews / month", you.reviewVelocity, c.reviewVelocity, false],
    ["Photos", you.photos, c.photos, false],
    ["GBP posts (30d)", you.posts30d, c.posts30d, false],
    ["Categories", you.categories.length, c.categories.length, false],
    ["Avg grid rank", you.avgGridRank, c.avgGridRank, true],
    ["Share of local voice", you.solv, c.solv, false],
    ["Referring domains", Math.round(you.backlinks / 5.8), Math.round(c.backlinks / 5.8), false],
  ];

  return (
    <>
      <PageHeader
        crumbs={<span className="flex items-center gap-1"><Link to="/competitors" className="hover:text-fg">Competitors</Link><ChevronRight size={12} />{c.name}</span>}
        title={c.name}
        sub={<span className="inline-flex items-center gap-1">{c.website} <ExternalLink size={11} /> · {c.distanceMi} mi from you</span>}
        actions={<Button>Stop tracking</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card pad={false}>
          <div className="grid grid-cols-[1fr_100px_100px] border-b border-line px-5 py-2.5 text-[12.5px] text-muted">
            <span>Signal</span><span className="text-right">You</span><span className="text-right">Them</span>
          </div>
          {rows.map(([label, a, b, lower]) => {
            const youWin = lower ? a < b : a > b;
            const tie = a === b;
            return (
              <div key={label} className="grid grid-cols-[1fr_100px_100px] items-center border-b border-line px-5 py-3 text-[13.5px] last:border-0">
                <span>{label}</span>
                <span className={cn("num text-right", !tie && (youWin ? "font-medium text-good" : "text-muted"))}>{fmt(a)}</span>
                <span className={cn("num text-right", !tie && (!youWin ? "font-medium text-bad" : "text-muted"))}>{fmt(b)}</span>
              </div>
            );
          })}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Gaps to close" />
            <ul className="space-y-3 text-[13.5px]">
              {missingCats.length > 0 && (
                <li>
                  <div className="font-medium">Categories you don't use</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">{missingCats.map((m) => <Badge key={m} tone="warn">{m}</Badge>)}</div>
                </li>
              )}
              {c.reviewVelocity > you.reviewVelocity && <li>They earn <b className="font-medium">{(c.reviewVelocity / you.reviewVelocity).toFixed(1)}×</b> more reviews per month.</li>}
              {c.posts30d > you.posts30d && <li>They posted <b className="font-medium">{c.posts30d}</b> GBP updates in 30 days. You posted {you.posts30d}.</li>}
              {c.photos > you.photos && <li>They have <b className="font-medium">{c.photos - you.photos}</b> more photos.</li>}
            </ul>
            <Link to="/actions/a1"><Button variant="primary" className="mt-5 w-full" icon={<Wand2 size={14} />}>Close the category gap</Button></Link>
          </Card>
          <Card>
            <CardHeader title="Their categories" />
            <ul className="space-y-1.5 text-[13.5px]">
              {c.categories.map((cat) => (
                <li key={cat} className="flex items-center gap-2">
                  {you.categories.includes(cat) ? <Check size={14} className="text-good" /> : <XIcon size={14} className="text-bad" />}
                  {cat}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-6" pad={false}>
        <div className="px-5 pt-5"><CardHeader title="Keyword overlap" sub="Map pack position on your tracked keywords" /></div>
        <table className="w-full text-[13.5px]">
          <thead className="border-y border-line text-left text-[12.5px] text-muted"><tr><th className="px-5 py-2 font-normal">Keyword</th><th className="px-3 py-2 text-right font-normal">You</th><th className="px-5 py-2 text-right font-normal">Them</th></tr></thead>
          <tbody>
            {keywords.filter((k) => k.local).slice(0, 8).map((k, i) => {
              const them = Math.max(1, (k.local! + (i % 3) - 2));
              return (
                <tr key={k.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-2.5"><Link to={`/rankings/${k.id}`} className="hover:underline">{k.term}</Link></td>
                  <td className={cn("num px-3 py-2.5 text-right", k.local! < them && "font-medium text-good")}>#{k.local}</td>
                  <td className={cn("num px-5 py-2.5 text-right", them < k.local! && "font-medium text-bad")}>#{them}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
