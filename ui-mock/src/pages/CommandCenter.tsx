import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { CommandTop } from "../components/CommandTop";
import { Composer, MarkoAvatar } from "../components/Assistant";
import { TaskDrawer, ThisWeek } from "../components/Todo";
import { actions, business } from "../data/mock";
import { openTasksFor, useRunState, type Task } from "../lib/tasks";
import { primeTasks, type PageContext } from "../lib/assistant";
import { CalendarDays, Eye, Flame, MessagesSquare } from "lucide-react";
import { Card, fmt } from "../components/ui";
import { AccountBadge, dayLabel } from "../components/Social";
import { PlatformBadge } from "./SocialScanner";
import { totals, useSocialPosts } from "../lib/social";
import { openOpportunities, useScanner, visibleTrends } from "../lib/scanner";
import { useWatched } from "../lib/watch";
import { standoutPosts } from "../data/watch";
import { platformOf as scanPlatform } from "../data/scanner";
import { accounts } from "../data/social";
import { accountConnected, useSetup } from "../lib/setup";
import { isOn, useFeatures } from "../lib/features";

// Home is Marko's weekly brief: how search and social did, what's happening on
// social this week, what Marko already did, the three things that need you, and
// a box to reply. Replies continue in the ⌘J panel.
export default function CommandCenter() {
  const ctx = useOutletContext<PageContext>();
  const state = useRunState();
  const flags = useFeatures();
  const [open, setOpen] = useState<Task | null>(null);
  const top3 = openTasksFor(state).slice(0, 3).map((t) => t.id);
  useEffect(() => { primeTasks(top3); }, [top3.join()]);
  const didAlready = actions.filter((a) => a.status === "done" || a.status === "running").map((a) => a.title.charAt(0).toLowerCase() + a.title.slice(1));
  const posts = useSocialPosts();
  const best = posts.filter((p) => p.status === "published" && p.day >= -7).sort((a, b) => totals(b).views - totals(a).views)[0];

  return (
    <>
      <div className="mb-6">
        <div className="text-[12.5px] text-muted">Friday, Oct 30 · Weekly brief</div>
        <h1 className="mt-1 font-serif text-[40px] leading-[1.1] tracking-[-0.02em]">Good morning, Dr. Patel.</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted">How {business.name} did{isOn("seo", flags) && isOn("social", flags) ? " on search and social" : isOn("seo", flags) ? " on search" : isOn("social", flags) ? " on social" : ""}, and what needs you this week.</p>
      </div>

      {/* Each block belongs to a feature; a turned-off one leaves Home. */}
      {isOn("seo", flags) && <CommandTop state={state} />}
      {isOn("social", flags) && <SocialThisWeek />}

      <div className="flex gap-3">
        <MarkoAvatar />
        <div className="min-w-0 flex-1">
          {didAlready.length > 0 && (
            <p className="mt-0.5 mb-4 text-[14px] leading-[1.55]">
              <b className="font-medium">While you were away</b> I {didAlready.join(" and ")}.{best && <> Your post “{best.title}” was seen {fmt(totals(best).views)} times, your best this week.</>} <Link to="/settings/activity" className="text-accent hover:underline">See activity</Link>
            </p>
          )}
          <ThisWeek onOpen={setOpen} heading={<p className="m-0 text-[14px] leading-[1.55]">Three things need you this week:</p>} />
          {isOn("marko", flags) && <div className="mt-5">
            <Composer big ctx={ctx} placeholder="Reply, ask a question or tell Marko what to do…" chips={["Do all three", "Who should I reply to today?", "What's trending this week?", "Which keywords dropped?"]} />
          </div>}
        </div>
      </div>

      <TaskDrawer task={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Four glances at social: what's going out, who to reply to, what's trending, what someone you watch did well. */
function SocialThisWeek() {
  const posts = useSocialPosts();
  const { config } = useScanner();
  const watched = useWatched();
  const setup = useSetup();
  const anyAccount = accounts.some((a) => accountConnected(a.id, setup));
  const next = posts.filter((p) => p.status === "scheduled" && p.day >= 0).sort((a, b) => a.day - b.day)[0];
  const scheduled = posts.filter((p) => p.status === "scheduled" && p.day >= 0 && p.day < 7).length;
  const convos = openOpportunities();
  const trend = visibleTrends(config)[0];
  const standout = standoutPosts.map((p) => ({ p, w: watched.find((w) => w.id === p.profileId) })).filter((x) => x.w).sort((a, b) => b.p.multiple - a.p.multiple)[0];

  const tiles = [
    {
      to: "/social/posts", icon: CalendarDays, label: "Going out next",
      title: !anyAccount ? "Connect a social account" : next ? next.title : "Nothing scheduled",
      sub: !anyAccount ? "Then plan posts here" : next ? <span className="inline-flex items-center gap-1">{next.accounts.map((a) => <AccountBadge key={a} id={a} size={14} />)} {dayLabel(next.day)}, {next.time} · {scheduled} this week</span> : "Remix a trend to fill the week",
    },
    {
      to: "/social/scanner", icon: MessagesSquare, label: "Conversations to join",
      title: convos.length ? `${convos.length} people to reply to` : "No one to reply to",
      sub: convos[0] ? <span className="inline-flex min-w-0 items-center gap-1"><PlatformBadge id={convos[0].platform} size={14} /> <span className="truncate">{scanPlatform(convos[0].platform).name}: “{convos[0].title}”</span></span> : "Next scan runs tonight",
    },
    {
      to: "/social/scanner?tab=trending", icon: Flame, label: "Trending for you",
      title: trend ? trend.title.replace(/[“”]/g, "") : "Nothing fits yet",
      sub: trend ? `${trend.velocity} · fit ${trend.fit}` : "Adjust what's relevant in Settings",
    },
    {
      to: "/social/scanner?tab=watching", icon: Eye, label: "From profiles you watch",
      title: standout ? standout.p.caption : "Watch a competitor",
      sub: standout ? `${standout.w!.handle} · ${standout.p.multiple}× their usual` : "Or anyone whose posts you like",
    },
  ];

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="m-0 text-[13px] font-medium tracking-wide text-muted uppercase">Social this week</h2>
        <Link to="/social/scanner" className="text-[12.5px] text-muted hover:text-fg">Social scanner →</Link>
      </div>
      <Card pad={false} className="grid divide-line sm:grid-cols-2 sm:divide-x lg:grid-cols-4 max-sm:divide-y">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="block min-w-0 p-4 transition-colors hover:bg-hover/50 max-lg:sm:[&:nth-child(n+3)]:border-t max-lg:sm:[&:nth-child(n+3)]:border-line">
            <div className="flex items-center gap-1.5 text-[12px] text-muted"><t.icon size={13} /> {t.label}</div>
            <div className="mt-1.5 line-clamp-2 text-[14px] leading-snug font-medium">{t.title}</div>
            <div className="mt-1 truncate text-[12.5px] text-muted">{t.sub}</div>
          </Link>
        ))}
      </Card>
    </section>
  );
}
