// Site audit (/seo/site-audit): how the Location's website holds up, as one table of the kinds of issue the latest
// audit found, worst first: how many pages (or things) each was found on, the change since the audit before, the
// checks it holds back, and where its fix stands in the Action plan. The header's line is the site's health. A row
// opens the issue's own page (/seo/site-audit/<code>): why it matters, how to fix it (with what to paste), since when
// it's been found, and every page it's on. A switch above the table shows the Key pages instead (KeyPages.tsx), kept in
// `?view=key-pages`: they're read from the same crawl.
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Segmented, cn, fmt } from "../../components/ui";
import { Feedback, LoadError, useFeedback } from "../../components/Feedback";
import { fmtDate, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, seoApi } from "./api";
import { SiteFixSteps, type Helps } from "./actions";
import { kindsOf, useAfterCheck } from "./checks";
import { CheckIcon, Source, stack } from "./parts";
import KeyPages from "./KeyPages";
import { SeoHeader, useSeo, useSeoHref } from "./Seo";

type Severity = "error" | "warning" | "notice";
const severityTone: Record<Severity, "bad" | "warn" | "neutral"> = { error: "bad", warning: "warn", notice: "neutral" };
const severityName: Record<Severity, string> = { error: "Error", warning: "Warning", notice: "Notice" };
const shortHelps: Record<Helps, string> = { maps: "Maps", keywords: "Search", ai: "AI answers" };

/** How much was found: pages, things ("2 services"), or the site as a whole. */
const foundText = (per: string, count: number, unit: [string, string] | null) =>
  per === "page"
    ? `${fmt(count)} ${count === 1 ? "page" : "pages"}`
    : unit
      ? `${fmt(count)} ${count === 1 ? unit[0] : unit[1]}`
      : "Site-wide";

const source = (
  <Source>
    Your website as search engines first read it: crawled from the home page by following its own links, without running JavaScript, up to
    the page limit, through DataForSEO. robots.txt and llms.txt are read from the site itself. Your phone number is compared with your
    Google profile's. Audited once a week at most, or when you ask.
  </Source>
);

export default function SiteAudit() {
  const code = useParams()["*"];
  return code ? <IssuePage key={code} code={code} /> : <IssueList />;
}

const th = stack.pad;

/** "Since last audit": fewer is better. Nothing to compare on the first audit. */
function Moved({ now, before }: { now: number; before: number | null }) {
  if (before === null) return <span className="text-muted">—</span>;
  if (before === 0) return <span className="text-[12.5px] text-bad">New</span>;
  const by = before - now;
  if (by === 0) return <span className="text-muted">—</span>;
  return <span className={cn("num", by > 0 ? "text-good" : "text-bad")}>{by > 0 ? `${by} fewer` : `${-by} more`}</span>;
}

function Hurts({ helps }: { helps: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {helps.map((h) => (
        <span key={h} className="inline-flex items-center gap-1 whitespace-nowrap">
          <CheckIcon check={h as Helps} size={13} />
          {shortHelps[h as Helps] ?? h}
        </span>
      ))}
    </span>
  );
}

type FixState = "open" | "done" | "dismissed" | null;
function PlanState({ state, severity }: { state: FixState; severity: Severity }) {
  if (severity === "notice") return <span className="text-[12.5px] text-subtle">Not in the plan</span>;
  if (state === "open") return <Badge tone="info">To do</Badge>;
  if (state === "done") return <Badge tone="warn">Marked done, still found</Badge>;
  if (state === "dismissed") return <span className="text-[12.5px] text-muted">Dismissed</span>;
  return <span className="text-muted">—</span>;
}

// ---------- Every kind of issue ----------

function IssueList() {
  const { orgId, location, can } = useSeo();
  const page = useLoad(() => locationApi(orgId, location.id).results.audit.get(), [orgId, location.id]);
  useAfterCheck(kindsOf["site-audit"], page.reload);
  const href = useSeoHref();
  const navigate = useNavigate();
  const data = page.data;
  const a = data?.audit;
  const change = a?.before ? a.health - a.before.health : null;
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "key-pages" ? "key-pages" : "issues";
  const show = (v: "issues" | "key-pages") =>
    setParams(
      (p) => {
        if (v === "issues") p.delete("view");
        else p.set("view", v);
        return p;
      },
      { replace: true },
    );

  return (
    <>
      <SeoHeader
        tab="site-audit"
        sub={
          a ? (
            <>
              <span className="text-fg">Health {a.health} of 100</span>
              {change !== null && change !== 0 && (
                <span className={change > 0 ? "text-good" : "text-bad"}>
                  {" "}
                  ({change > 0 ? "+" : "−"}
                  {Math.abs(change)} since the last audit)
                </span>
              )}
              {" · "}
              {a.errors} {a.errors === 1 ? "error" : "errors"}, {a.warnings} {a.warnings === 1 ? "warning" : "warnings"}
            </>
          ) : (
            "How your website holds up, page by page."
          )
        }
      />
      <LoadError what="the site audit">{page.error}</LoadError>
      {data && !data.website && (
        <Card>
          <p className="text-[14px] font-medium">No website to audit</p>
          <p className="mt-1 text-[13px] text-muted">Add {location.name}'s website in Search settings, then audit it from here.</p>
          {can("manage") && (
            <Link to={href("/seo/settings")} className="mt-2 inline-block text-[13px] underline underline-offset-2">
              Search settings
            </Link>
          )}
        </Card>
      )}
      {data?.website && !a && (
        <Card>
          <p className="text-[14px] font-medium">{data.website} hasn't been audited yet</p>
          <p className="mt-1 text-[13px] text-muted">
            {can("manage") ? "Audit now crawls it, usually in a few minutes." : "It's audited with the next scheduled check."}
          </p>
        </Card>
      )}
      {data && a && (
        <div className="mb-4">
          <Segmented
            label="Show"
            value={view}
            onChange={show}
            options={[
              { id: "issues", label: `Issues (${data.issues.length})` },
              { id: "key-pages", label: "Key pages" },
            ]}
          />
        </div>
      )}
      {data && a && view === "key-pages" && <KeyPages />}
      {data && a && view === "issues" && (
        <Card pad={false} className="overflow-x-auto">
          <table role="table" className={stack.table}>
            <thead role="rowgroup" className={stack.head}>
              <tr className="border-b border-line text-left text-[12.5px] text-muted">
                <th className={cn(th, "pl-4")}>Issue</th>
                <th className={th}>Severity</th>
                <th className={cn(th, "text-right")}>Found</th>
                <th className={cn(th, "text-right")}>Since last audit</th>
                <th className={th}>Holds back</th>
                <th className={th}>Action plan</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody role="rowgroup" className={stack.body}>
              {data.issues.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">
                    No issues found. Nice work.
                  </td>
                </tr>
              )}
              {data.issues.map((i) => {
                const to = href(`/seo/site-audit/${i.code}`);
                const sev = i.severity as Severity;
                return (
                  <tr
                    key={i.code}
                    role="row"
                    className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-hover", stack.row)}
                    onClick={() => navigate(to)}
                  >
                    <td role="cell" className={cn(th, "pl-4", stack.first)}>
                      <Link to={to} onClick={(e) => e.stopPropagation()} className="font-medium underline-offset-2 hover:underline">
                        {i.title}
                      </Link>
                      <span className="block text-[12px] text-muted">{i.groupName}</span>
                    </td>
                    <td role="cell" data-label="Severity" className={cn(th, stack.cell)}>
                      <Badge tone={severityTone[sev]}>{severityName[sev]}</Badge>
                    </td>
                    <td role="cell" data-label="Found" className={cn(th, "num text-right whitespace-nowrap", stack.cell)}>
                      {foundText(i.per, i.count, i.unit)}
                    </td>
                    <td role="cell" data-label="Since last audit" className={cn(th, "text-right", stack.cell)}>
                      <Moved now={i.count} before={i.countBefore} />
                    </td>
                    <td role="cell" data-label="Holds back" className={cn(th, "text-[12.5px] text-muted", stack.cell)}>
                      <Hurts helps={i.helps} />
                    </td>
                    <td role="cell" data-label="Action plan" className={cn(th, stack.cell)}>
                      <PlanState state={i.fix?.state ?? null} severity={sev} />
                    </td>
                    <td role="cell" className={cn("pr-3", stack.hide)}>
                      <ChevronRight size={15} className="text-subtle" aria-hidden />
                    </td>
                  </tr>
                );
              })}
              <tr role="row" className={cn(stack.total, stack.row)}>
                <td role="cell" colSpan={7} className={cn(th, "pl-4 text-[13px]", stack.first)}>
                  {data.issues.length} kinds of issue on {fmt(a.pagesCrawled)} pages of {a.domain}, audited {fmtDate(a.checkedAt)}
                  {a.notices > 0 && (
                    <span className="font-normal text-muted"> · notices stay here; errors and warnings are in the Action plan</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
      {source}
    </>
  );
}

// ---------- One kind of issue ----------

function IssuePage({ code }: { code: string }) {
  const { orgId, location, can } = useSeo();
  const page = useLoad(() => locationApi(orgId, location.id).results.audit({ code }).get(), [orgId, location.id, code]);
  useAfterCheck(kindsOf["site-audit"], page.reload);
  const href = useSeoHref();
  const fb = useFeedback();
  const [busy, setBusy] = useState(false);

  if (page.error)
    return (
      <>
        <SeoHeader tab="site-audit" title="Issue not found" trail={[{ label: "Not found" }]} sub="" switcher={false} />
        <Card>
          <p className="text-[13.5px]">The latest audit of {location.name}'s website has nothing by this name.</p>
          <Link to={href("/seo/site-audit")} className="mt-2 inline-block text-[13px] underline underline-offset-2">
            The site audit
          </Link>
        </Card>
      </>
    );
  const d = page.data;
  if (!d) return null;
  const sev = d.severity as Severity;

  const act = async (what: "apply" | "dismiss") => {
    if (!d.planned) return;
    setBusy(true);
    fb.clear();
    const one = seoApi(orgId).suggestions({ suggestionId: d.planned.suggestionId });
    const r = what === "apply" ? await one.apply.post({}) : await one.dismiss.post();
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error), what === "apply" ? "Could not mark it done" : "Could not dismiss");
    fb.succeed(
      what === "apply" ? "Marked as done" : "Dismissed",
      what === "apply" ? "The next audit checks it." : "Taken off the Action plan.",
    );
    await page.reload();
  };

  return (
    <>
      <SeoHeader
        tab="site-audit"
        title={d.title}
        trail={[{ label: d.title }]}
        switcher={false}
        sub={
          <>
            <Badge tone={severityTone[sev]} className="mr-1.5 align-[1px]">
              {severityName[sev]}
            </Badge>
            {d.found ? (
              <>
                {d.per === "page"
                  ? `Found on ${foundText(d.per, d.found.count, d.unit)}`
                  : d.unit
                    ? foundText(d.per, d.found.count, d.unit)
                    : "Found site-wide"}
                {d.found.since && ` since ${fmtDate(d.found.since)}`}
              </>
            ) : (
              `Not found in the audit of ${fmtDate(d.checkedAt)}: fixed`
            )}
          </>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <h2 className="text-[15px] font-medium">Why it matters</h2>
          <p className="mt-1 max-w-[68ch] text-[13.5px] text-muted">{d.why}</p>
          <p className="mt-3 text-[12.5px] text-muted">
            Holds back <Hurts helps={d.helps} />
          </p>
          {d.found && <SiteFixSteps fix={{ code: d.code, steps: d.fix.steps, snippet: d.fix.snippet }} linkToIssue={false} />}
        </Card>
        <Card>
          <h2 className="text-[15px] font-medium">In the Action plan</h2>
          <div className="mt-2 text-[13.5px] text-muted">
            {sev === "notice" ? (
              <p>Notices stay on the audit, out of the Action plan. Fix them when you're in the page anyway.</p>
            ) : !d.found ? (
              <p>Fixed: the latest audit no longer finds it.</p>
            ) : d.planned?.state === "open" ? (
              <>
                <p>To do. Once you've fixed it on your site, mark it done; the next audit checks it.</p>
                {can("track") && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="primary" onClick={() => void act("apply")} disabled={busy}>
                      Mark as done
                    </Button>
                    <Button variant="ghost" onClick={() => void act("dismiss")} disabled={busy}>
                      Not now
                    </Button>
                  </div>
                )}
              </>
            ) : d.planned?.state === "done" ? (
              <p>
                Marked done{d.planned.decidedAt && ` on ${fmtDate(d.planned.decidedAt)}`}, but the latest audit still finds it. Check the
                steps again, or wait for the next audit if you fixed it since.
              </p>
            ) : d.planned?.state === "dismissed" ? (
              <p>Dismissed from the Action plan. It comes back if it's fixed and then found again.</p>
            ) : (
              <p>It joins the Action plan once this audit's suggestions are written.</p>
            )}
            <Feedback {...fb.props} />
          </div>
        </Card>
      </div>
      {d.found && (
        <Card pad={false} className="mt-6 overflow-x-auto">
          <h2 className="px-4 pt-4 text-[15px] font-medium">Where it was found</h2>
          {d.found.items.length > 0 && (
            <>
              {d.itemsLabel && <p className="mt-2 px-4 text-[12.5px] text-muted">{d.itemsLabel}</p>}
              <ul className="mt-1.5 flex flex-wrap gap-1.5 px-4">
                {d.found.items.map((x) => (
                  <li key={x}>
                    <Badge>{x}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.per === "site" ? (
            <p className="px-4 pt-3 pb-4 text-[12.5px] text-muted">
              Read from{" "}
              <a
                href={d.pages[0]?.url ?? `https://${d.domain}/`}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {(d.pages[0]?.url ?? d.domain).replace(/^https?:\/\//, "")}
              </a>
              {d.code === "ai_bots_blocked" && " and its robots.txt"}
              {d.code === "no_llms_txt" && `: nothing at /llms.txt`}.
            </p>
          ) : (
            <>
              <table role="table" className={cn(stack.table, "mt-2")}>
                <thead role="rowgroup" className={stack.head}>
                  <tr className="border-b border-line text-left text-[12.5px] text-muted">
                    <th className={cn(th, "pl-4")}>Page</th>
                    <th className={cn(th, "text-right")}>Status</th>
                    <th className={cn(th, "text-right")}>Words</th>
                    <th className={cn(th, "text-right")}>Load time</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className={stack.body}>
                  {d.pages.map((p) => (
                    <tr key={p.url} role="row" className={cn("border-b border-line last:border-0", stack.row)}>
                      <td role="cell" className={cn(th, "pl-4", stack.first)}>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 break-all underline-offset-2 hover:underline"
                        >
                          {p.url.replace(/^https?:\/\//, "")}
                          <ExternalLink size={12} className="shrink-0 text-subtle" aria-hidden />
                        </a>
                        {p.title && <span className="block truncate text-[12px] text-muted">{p.title}</span>}
                      </td>
                      <td
                        role="cell"
                        data-label="Status"
                        className={cn(th, "num text-right", stack.cell, p.statusCode >= 400 && "text-bad")}
                      >
                        {p.statusCode}
                      </td>
                      <td role="cell" data-label="Words" className={cn(th, "num text-right", stack.cell)}>
                        {p.wordCount === null ? "—" : fmt(p.wordCount)}
                      </td>
                      <td
                        role="cell"
                        data-label="Load time"
                        className={cn(th, "num text-right", stack.cell, (p.loadMs ?? 0) > 3000 && "text-bad")}
                      >
                        {p.loadMs === null ? "—" : `${(p.loadMs / 1000).toFixed(1)} s`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {d.pages.length >= 500 && <p className="px-4 py-3 text-[12.5px] text-muted">The first 500 pages.</p>}
        </Card>
      )}
      {source}
    </>
  );
}
