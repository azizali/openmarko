// Checks on every SEO page: when this page's data was last checked, a quiet chip while a check runs (with when it
// started, and a link to its status), and Check now. Check now checks what this page shows; the drawer it opens offers
// the other kinds too. One status is loaded for the whole SEO section and looked at again every 10 seconds while
// something is running, so every page agrees and reloads its own data when its kind of check finishes. A check just
// started is queued for the worker before the status knows of it: it shows as starting, looked at every 3 seconds,
// until it's running.
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button, Checkbox, Drawer, cn, FormFooter } from "../../components/ui";
import { Feedback, useFeedback, useToast } from "../../components/Feedback";
import { fmtTime, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { engineNames, locationApi, type CheckStatus } from "./api";
import { gridArea } from "./distance";
import { everyLabel, type Every } from "./fields";
import { useSeo, type SeoTab } from "./Seo";

export type CheckKind = "maps" | "organic" | "ai" | "audit";
/** The rankings: what the overview and Competitors show, and what "Check now" means there. */
const rankingKinds: CheckKind[] = ["maps", "organic", "ai"];
/** Every kind, for a page that changes after any of them (the Action plan). */
export const everyKind: CheckKind[] = [...rankingKinds, "audit"];
export const kindNames: Record<CheckKind, string> = {
  maps: "Google Maps",
  organic: "Google search",
  ai: "AI answers",
  audit: "Site audit",
};
/** For the header's chip, where the whole line must fit on one row. */
const shortNames: Record<CheckKind, string> = { maps: "Maps", organic: "Search", ai: "AI answers", audit: "Site audit" };

/** What each page shows, so what its Check now checks. The Action plan and Settings show no results of their own. */
export const kindsOf: Record<SeoTab, CheckKind[]> = {
  overview: rankingKinds,
  competitors: rankingKinds,
  maps: ["maps"],
  keywords: ["organic"],
  ai: ["ai"],
  "site-audit": ["audit"],
  plan: [],
  settings: [],
};

/** Kinds just started and not yet running, with when, and each one's last check then (a fast check may finish unseen). */
type Queued = { locationId: string; kinds: CheckKind[]; at: number; lastCheckedAt: Record<string, string | null> };
type Checks = {
  status: CheckStatus | null;
  reload: () => Promise<void>;
  /** The kinds started from this page that the worker hasn't picked up yet. */
  starting: CheckKind[];
  started: (kinds: CheckKind[]) => void;
};
const ChecksContext = createContext<Checks>({
  status: null,
  reload: async () => {},
  starting: [],
  started: () => {},
});

const stamp = (d: string | Date | null) => (d ? String(d) : null);

/** How long a started check may wait for the worker before it's no longer shown as starting. */
const STARTING_FOR_MS = 2 * 60_000;

export function ChecksProvider({ children }: { children: ReactNode }) {
  const { orgId, location } = useSeo();
  const checks = useLoad(() => locationApi(orgId, location.id).checks.get(), [orgId, location.id]);
  const status = checks.data ?? null;
  const [queued, setQueued] = useState<Queued | null>(null);
  const busy = !!status && (status.finishing || status.kinds.some((k) => k.running));
  const reload = checks.reload;
  // Picked up (running), done already, or waited too long: no longer starting.
  useEffect(() => {
    if (!queued || !status) return;
    const mine = status.kinds.filter((k) => queued.kinds.includes(k.kind));
    if (mine.some((k) => k.running || stamp(k.lastCheckedAt) !== queued.lastCheckedAt[k.kind]) || Date.now() - queued.at > STARTING_FOR_MS)
      setQueued(null);
  }, [queued, status]);
  useEffect(() => {
    if (!busy && !queued) return;
    const t = setInterval(() => void reload(), queued ? 3_000 : 10_000);
    return () => clearInterval(t);
  }, [busy, queued, reload]);
  const started = (kinds: CheckKind[]) =>
    setQueued({
      locationId: location.id,
      kinds,
      at: Date.now(),
      lastCheckedAt: Object.fromEntries((status?.kinds ?? []).map((k) => [k.kind, stamp(k.lastCheckedAt)])),
    });
  return (
    <ChecksContext value={{ status, reload, starting: queued?.locationId === location.id ? queued.kinds : [], started }}>
      {children}
    </ChecksContext>
  );
}

/**
 * Calls `reload` when one of these kinds of check finishes, and once more when the whole cycle has (its suggestions
 * are written last). Not on first load, and not when the Location changes: the page loads that itself.
 */
export function useAfterCheck(kinds: CheckKind[], reload: () => unknown) {
  const { status } = use(ChecksContext);
  const { location } = useSeo();
  const sig = status
    ? `${location.id}|${status.kinds
        .filter((k) => kinds.includes(k.kind))
        .map((k) => `${k.lastCheckedAt}`)
        .join(",")}|${status.finishing}`
    : null;
  const before = useRef<string | null>(null);
  const call = useRef(reload);
  useEffect(() => {
    call.current = reload;
  });
  useEffect(() => {
    const was = before.current;
    before.current = sig;
    if (was && sig && was !== sig && was.split("|")[0] === sig.split("|")[0]) void call.current();
  }, [sig]);
}

/**
 * Looks again every 15 seconds while something just added waits for its first result (its check is queued for the
 * worker, so the status can't know of it yet), and stops once nothing is.
 */
export function useReloadWhilePending(pending: boolean, reload: () => Promise<void>) {
  const { reload: reloadChecks } = use(ChecksContext);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void Promise.all([reload(), reloadChecks()]), 15_000);
    return () => clearInterval(t);
  }, [pending, reload, reloadChecks]);
}

const ago = (d: string | Date) => {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};
const latest = (dates: (string | Date | null)[]) =>
  dates.reduce<string | Date | null>((a, b) => (!b ? a : !a || new Date(b) > new Date(a) ? b : a), null);
/** The time alone when it's today, else the date and time. */
const clock = (d: string | Date) =>
  new Date(d).toDateString() === new Date().toDateString()
    ? new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : fmtTime(d);
const list = (names: string[]) => (names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** Under Check now: when the page's data was last checked, and what's checking now. Quiet unless something's running. */
export function CheckLine({ tab, className }: { tab: SeoTab; className?: string }) {
  const { status, starting } = use(ChecksContext);
  const [open, setOpen] = useState(false);
  const kinds = kindsOf[tab];
  if (!status || !kinds.length) return null;
  const mine = status.kinds.filter((k) => kinds.includes(k.kind));
  const last = latest(mine.map((k) => k.lastCheckedAt));
  const running = status.kinds.filter((k) => k.running);
  const since = latest(running.map((k) => k.running!.startedAt));
  const failed = mine.filter((k) => k.lastError && !k.running);
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted", className)}>
      <span className="inline-flex items-center gap-1.5">
        {/* Green once there are results to read; grey until the first check, or when the last one failed. */}
        <span className={cn("size-2 shrink-0 rounded-full", last && !failed.length ? "bg-good" : "bg-subtle")} aria-hidden />
        {last ? (
          <span title={fmtTime(last)}>
            Checked <span className="font-medium text-fg">{ago(last)}</span>
            <span className="hidden text-subtle sm:inline"> · {fmtTime(last)}</span>
          </span>
        ) : (
          "Not checked yet"
        )}
      </span>
      {(running.length > 0 || starting.length > 0 || status.finishing) && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={
            running.length
              ? `Checking ${list(running.map((k) => kindNames[k.kind]))}, started ${fmtTime(since!)}. See status.`
              : starting.length
                ? `Starting ${list(starting.map((k) => kindNames[k]))}. See status.`
                : "Every result is in. Writing suggestions. See status."
          }
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-info-soft py-0.5 pl-2.5 pr-1.5 font-medium text-info transition-opacity hover:opacity-80"
        >
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-info" />
          </span>
          {running.length ? (
            <>
              Checking {list(running.map((k) => shortNames[k.kind]))}
              <span className="font-normal opacity-80">· since {clock(since!)}</span>
            </>
          ) : starting.length ? (
            `Starting ${list(starting.map((k) => shortNames[k]))}…`
          ) : (
            "Writing suggestions"
          )}
          <ChevronRight size={13} aria-hidden className="-ml-0.5 opacity-70" />
        </button>
      )}
      {failed.length > 0 && (
        <button type="button" onClick={() => setOpen(true)} className="text-bad underline decoration-bad/40 underline-offset-2">
          The last {list(failed.map((k) => kindNames[k.kind]))} check failed
        </button>
      )}
      {open && <ChecksDrawer open onClose={() => setOpen(false)} preselect={[]} />}
    </span>
  );
}

/** Check now: checks this page's kinds, offering the others. Disabled while all of this page's kinds are running. */
export function CheckNowButton({ tab }: { tab: SeoTab }) {
  const { status, starting } = use(ChecksContext);
  const { can } = useSeo();
  const [open, setOpen] = useState(false);
  const kinds = kindsOf[tab];
  if (!can("manage") || !kinds.length) return null;
  const busy = !!status && kinds.every((k) => starting.includes(k) || status.kinds.find((s) => s.kind === k)?.running);
  return (
    <>
      <Button
        icon={busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        onClick={() => setOpen(true)}
        disabled={!status || busy}
      >
        {busy
          ? kinds.includes("audit")
            ? "Auditing…"
            : "Checking…"
          : kinds.length === 1 && kinds[0] === "audit"
            ? "Audit now"
            : "Check now"}
      </Button>
      {open && <ChecksDrawer open onClose={() => setOpen(false)} preselect={kinds} />}
    </>
  );
}

/** Each kind of check: what it asks, where it stands, and (for whoever may) a box to check it now. */
function ChecksDrawer({ open, onClose, preselect }: { open: boolean; onClose: () => void; preselect: CheckKind[] }) {
  const { orgId, location, can } = useSeo();
  const { status, reload, starting: queued, started } = use(ChecksContext);
  const toast = useToast();
  const fb = useFeedback(open);
  const [picked, setPicked] = useState<Set<CheckKind>>(() => new Set(preselect));
  const [starting, setStarting] = useState(false);
  if (!status) return null;
  const manage = can("manage");
  const what: Record<CheckKind, string> = {
    maps: `${status.mapsKeywords} keyword${status.mapsKeywords === 1 ? "" : "s"} across ${gridArea(location.gridRadiusM)}`,
    organic: `${status.organicKeywords} keyword${status.organicKeywords === 1 ? "" : "s"} from your address`,
    ai: `${status.questions} question${status.questions === 1 ? "" : "s"} asked of ${list(location.engines.map((e) => engineNames[e] ?? e))}`,
    audit: `Up to ${status.auditPages} pages of ${status.website ?? "your website"}`,
  };
  const empty = (k: CheckKind) =>
    k === "audit"
      ? !status.website
      : k === "ai"
        ? status.questions === 0
        : k === "maps"
          ? status.mapsKeywords === 0
          : status.organicKeywords === 0;
  const nothing = (k: CheckKind) => (k === "audit" ? "No website to audit. Add it in Search settings." : "Nothing to check yet");
  const canPick = (k: CheckKind) => manage && !empty(k) && !queued.includes(k) && !status.kinds.find((s) => s.kind === k)?.running;
  const chosen = [...picked].filter(canPick);

  const start = async () => {
    setStarting(true);
    const r = await locationApi(orgId, location.id).check.post({
      kinds: chosen,
    });
    setStarting(false);
    if (r.error) return fb.fail(messageOf(r.error), "Could not start the check");
    started(r.data.kinds);
    await reload();
    toast.success(`Checking ${list(r.data.kinds.map((k) => kindNames[k]))}`, "Results usually take a few minutes. You can keep working.");
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={manage ? "Check now" : "Checks"}
      feedback={<Feedback {...fb.props} />}
      footer={
        manage ? (
          <FormFooter
            cancel="Close"
            onCancel={onClose}
            onAction={() => void start()}
            disabled={!chosen.length || starting}
            action={
              starting
                ? "Starting…"
                : chosen.length
                  ? `Check ${chosen.length > 2 && chosen.length === status.kinds.filter((k) => !empty(k.kind)).length ? "everything" : list(chosen.map((k) => kindNames[k]))}`
                  : "Check"
            }
          />
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <ul className="divide-y divide-line">
        {status.kinds.map((s) => {
          const on = canPick(s.kind) && picked.has(s.kind);
          return (
            <li key={s.kind}>
              <label className={cn("flex gap-3 py-3.5", canPick(s.kind) && "cursor-pointer")}>
                {manage && (
                  <span className="pt-0.5">
                    {canPick(s.kind) ? (
                      <Checkbox
                        checked={on}
                        label={kindNames[s.kind]}
                        onChange={(v) => setPicked((p) => (v ? new Set(p).add(s.kind) : new Set([...p].filter((k) => k !== s.kind))))}
                      />
                    ) : (
                      <span className="block size-4" />
                    )}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{kindNames[s.kind]}</span>
                  <span className="block text-[12.5px] text-muted">{empty(s.kind) ? nothing(s.kind) : what[s.kind]}</span>
                  <span className="mt-1 block text-[12.5px]">
                    {queued.includes(s.kind) && !s.running ? (
                      <span className="text-info">Starting…</span>
                    ) : s.running ? (
                      <span className="text-info">
                        {s.kind === "audit"
                          ? `Crawling your site since ${fmtTime(s.running.startedAt)}`
                          : `Checking since ${fmtTime(s.running.startedAt)} · ${s.running.received} of ${s.running.calls} results in`}
                      </span>
                    ) : s.lastError ? (
                      <span className="text-bad">Last check failed: {s.lastError}</span>
                    ) : (
                      <span className="text-subtle">
                        {s.lastCheckedAt ? `Last checked ${ago(s.lastCheckedAt)} · ${fmtTime(s.lastCheckedAt)}` : "Not checked yet"}
                      </span>
                    )}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {status.finishing && <p className="mt-2 text-[12.5px] text-info">Every result is in. Writing suggestions…</p>}
      <p className="mt-4 text-[12.5px] text-subtle">
        Results usually take a few minutes, Google search a little longer. You can keep working: each page updates when its results are in.
        {manage &&
          ` Checks also run on their own: ${(everyLabel[location.checkEvery as Every] ?? "on a schedule").toLowerCase()}, and the site audit once a week at most.`}
      </p>
    </Drawer>
  );
}
