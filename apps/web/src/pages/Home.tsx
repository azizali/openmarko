// Home: where the Organization stands, and the quickest way into each part of the app.
import { Link } from "react-router";
import { ArrowRight, BookOpen, ListChecks, Settings, Sparkles } from "lucide-react";
import { Card, CardHeader, PageHeader, Stat } from "../components/ui";
import { api, fmtTime } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useOrg, useSession } from "../lib/session";
import { modules } from "../lib/modules";
import { nav } from "../components/Layout";

export default function Home() {
  const org = useOrg();
  const { me, can } = useSession();
  const members = useLoad(() => api.api.v1.organizations({ orgId: org.id }).members.get(), [org.id]);
  const features = useLoad(() => api.api.v1.organizations({ orgId: org.id }).features.get(), [org.id]);
  const activity = useLoad(
    () =>
      modules.automation && can("activity", "view")
        ? api.api.v1.organizations({ orgId: org.id }).activity.get()
        : Promise.resolve({ data: null, error: null }),
    [org.id, can("activity", "view")],
  );
  const on = features.data ? Object.values(features.data as Record<string, { on: boolean }>).filter((f) => f.on).length : null;
  const total = features.data ? Object.keys(features.data).length : null;
  const icons = { Assistant: Sparkles, "Knowledge base": BookOpen, Automation: ListChecks, Settings } as const;
  const shortcuts = nav.filter((n) => n.to !== "/" && n.label in icons);

  return (
    <>
      <PageHeader
        title={
          <>
            Good day, <span className="ink-sheen">{me?.name.split(" ")[0]}</span>
          </>
        }
        sub={`${org.name} · you're ${org.role} here.`}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat label="People" value={members.data?.length ?? "–"} hint="Members of this organization" />
        </Card>
        <Card>
          <Stat label="Features on" value={on === null ? "–" : `${on}/${total}`} hint="Settings → Features" />
        </Card>
        <Card>
          <Stat label="Your role" value={<span className="capitalize">{org.role}</span>} />
        </Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {modules.automation && can("activity", "view") ? (
          <Card>
            <CardHeader
              title="Recent activity"
              sub="Who changed what, newest first."
              right={
                <Link to="/automation" className="text-[13px] text-muted hover:text-fg">
                  All
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {(activity.data ?? []).slice(0, 8).map((a) => (
                <li key={String(a.id)} className="flex items-baseline justify-between gap-4 py-2 text-[13.5px]">
                  <span className="min-w-0 truncate">{a.summary}</span>
                  <span className="shrink-0 text-[12px] text-subtle">{fmtTime(a.createdAt as unknown as string)}</span>
                </li>
              ))}
              {activity.data && activity.data.length === 0 && (
                <li className="py-6 text-center text-[13px] text-muted">Nothing yet. Changes you make show here.</li>
              )}
            </ul>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Getting started" sub="A few things to set up." />
            <ul className="space-y-2 text-[13.5px]">
              <li>
                Invite your team from{" "}
                <Link to="/settings/team" className="underline-offset-2 hover:underline">
                  Settings → Team
                </Link>
                .
              </li>
              <li>
                Connect providers in{" "}
                <Link to="/settings/integrations" className="underline-offset-2 hover:underline">
                  Settings → Integrations
                </Link>
                .
              </li>
              <li>
                Turn features on and off in{" "}
                <Link to="/settings/features" className="underline-offset-2 hover:underline">
                  Settings → Features
                </Link>
                .
              </li>
            </ul>
          </Card>
        )}
        <Card>
          <CardHeader title="Go to" />
          <ul className="space-y-1">
            {shortcuts.map((s) => {
              const Icon = icons[s.label as keyof typeof icons];
              return (
                <li key={s.to}>
                  <Link to={s.to} className="flex items-center gap-3 rounded-lg px-2 py-2 text-[13.5px] hover:bg-hover">
                    <span className="grid size-7 place-items-center rounded-md bg-hover text-muted">
                      <Icon size={15} />
                    </span>
                    <span className="flex-1">{s.label}</span>
                    <ArrowRight size={14} className="text-subtle" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
