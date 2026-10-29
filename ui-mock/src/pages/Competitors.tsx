import { Link, useNavigate } from "react-router";
import { Plus, Star } from "lucide-react";
import { Badge, Button, Card, PageHeader, Progress, cn, fmt } from "../components/ui";
import { competitors } from "../data/mock";

export default function Competitors() {
  const navigate = useNavigate();
  const you = competitors.find((c) => c.isYou)!;
  const sorted = [...competitors].sort((a, b) => b.solv - a.solv);
  const leader = sorted[0];

  return (
    <>
      <PageHeader
        title="Competitors"
        sub="Businesses that share the map pack with you most often. Profiles refresh weekly from DataForSEO Business Data."
        actions={<Button variant="primary" icon={<Plus size={14} />}>Add competitor</Button>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Review gap to leader", `${leader.reviews - you.reviews}`, `${leader.name} has ${fmt(leader.reviews)}`],
          ["Review velocity", `${you.reviewVelocity}/mo`, `Leader ${leader.reviewVelocity}/mo`],
          ["Categories", `${you.categories.length}`, `Leader uses ${leader.categories.length}`],
        ].map(([l, v, s]) => (
          <Card key={l} className="!p-4">
            <div className="text-[12.5px] text-muted">{l}</div>
            <div className="num mt-1 font-serif text-[26px] leading-none">{v}</div>
            <div className="mt-1.5 text-[12px] text-subtle">{s}</div>
          </Card>
        ))}
      </div>

      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13.5px]">
          <thead className="border-b border-line text-left text-[12.5px] text-muted">
            <tr>
              <th className="px-5 py-2.5 font-normal">Business</th>
              <th className="px-3 py-2.5 font-normal">SoLV</th>
              <th className="px-3 py-2.5 text-right font-normal">Avg grid rank</th>
              <th className="px-3 py-2.5 text-right font-normal">Rating</th>
              <th className="px-3 py-2.5 text-right font-normal">Reviews</th>
              <th className="px-3 py-2.5 text-right font-normal">/mo</th>
              <th className="px-3 py-2.5 text-right font-normal">Photos</th>
              <th className="px-3 py-2.5 text-right font-normal">Posts 30d</th>
              <th className="px-3 py-2.5 pr-5 text-right font-normal">Ref. domains</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} onClick={() => !c.isYou && navigate(`/competitors/${c.id}`)} className={cn("border-b border-line last:border-0", c.isYou ? "bg-accent-soft/30" : "cursor-pointer hover:bg-hover")}>
                <td className="px-5 py-3">
                  <div className="font-medium">{c.isYou ? c.name : <Link to={`/competitors/${c.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{c.name}</Link>} {c.isYou && <Badge tone="accent">You</Badge>}</div>
                  <div className="text-[12px] text-muted">{c.categories.length} categories · {c.isYou ? "your location" : `${c.distanceMi} mi`}</div>
                </td>
                <td className="w-36 px-3 py-3"><div className="flex items-center gap-2"><Progress value={c.solv} tone={c.isYou ? "accent" : "ink"} className="w-16" /><span className="num text-muted">{c.solv}%</span></div></td>
                <td className="num px-3 py-3 text-right">{c.avgGridRank.toFixed(1)}</td>
                <td className="num px-3 py-3 text-right"><span className="inline-flex items-center gap-1"><Star size={11} className="fill-current text-warn" />{c.rating}</span></td>
                <td className="num px-3 py-3 text-right">{fmt(c.reviews)}</td>
                <td className={cn("num px-3 py-3 text-right", !c.isYou && c.reviewVelocity > you.reviewVelocity && "text-bad")}>{c.reviewVelocity}</td>
                <td className="num px-3 py-3 text-right">{c.photos}</td>
                <td className="num px-3 py-3 text-right">{c.posts30d}</td>
                <td className="num px-3 py-3 pr-5 text-right">{Math.round(c.backlinks / 5.8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-[12px] text-subtle">Red values: competitor is ahead of you.</p>
    </>
  );
}
