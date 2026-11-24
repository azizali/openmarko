// The Action plan (/seo/plan): everything that should move the Location's rankings, best first, from every source:
// the site audit, the Google profile (categories, description, posts), what to track, and where to get listed. Two
// filters narrow it: the check an action should move (`?helps=`, where each Rankings page's "· 3 actions" link
// lands) and where it came from. What was done in the last 30 days is listed under it, with Undo.
import { useSearchParams } from "react-router";
import { Segmented } from "../../components/ui";
import { LoadError } from "../../components/Feedback";
import { useLoad } from "../../lib/useLoad";
import { locationApi } from "./api";
import { ActionList, DoneList, sourceNames, type Helps, type Source } from "./actions";
import { everyKind, useAfterCheck } from "./checks";
import { SeoHeader, useSeo } from "./Seo";

type HelpsFilter = "all" | Helps;
type SourceFilter = "all" | Source;
const helpsFilters = new Set<string>(["all", "maps", "keywords", "ai"]);
const sourceOrder: Source[] = ["audit", "profile", "tracking", "listings"];

export default function Plan() {
  const { orgId, location } = useSeo();
  const [params, setParams] = useSearchParams();
  const plan = useLoad(() => locationApi(orgId, location.id).suggestions.get(), [orgId, location.id]);
  // Actions are written when a cycle ends, an audit's included.
  useAfterCheck(everyKind, plan.reload);

  const askedHelps = params.get("helps") ?? "all";
  const helps = (helpsFilters.has(askedHelps) ? askedHelps : "all") as HelpsFilter;
  const askedSource = params.get("from") ?? "all";
  const from = (askedSource === "all" || sourceOrder.includes(askedSource as Source) ? askedSource : "all") as SourceFilter;
  const set = (key: string, value: string) =>
    setParams(
      (p) => {
        if (value === "all") p.delete(key);
        else p.set(key, value);
        return p;
      },
      { replace: true },
    );

  const open = plan.data?.open ?? [];
  const shown = open.filter((s) => (helps === "all" || s.helpsAll.includes(helps)) && (from === "all" || s.source === from));
  const sources = sourceOrder.filter((x) => open.some((s) => s.source === x));
  const reload = async () => void (await plan.reload());

  return (
    <>
      <SeoHeader
        tab="plan"
        sub={
          plan.data
            ? `${open.length} ${open.length === 1 ? "action" : "actions"} that should move your rankings, most useful first.`
            : "What should move your rankings, most useful first."
        }
      />
      <LoadError what="the Action plan">{plan.error}</LoadError>
      {plan.data && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Segmented<HelpsFilter>
              label="Actions for"
              value={helps}
              onChange={(v) => set("helps", v)}
              options={[
                { id: "all", label: "All" },
                { id: "maps", label: "Maps" },
                { id: "keywords", label: "Search" },
                { id: "ai", label: "AI" },
              ]}
            />
            {sources.length > 1 && (
              <Segmented<SourceFilter>
                label="Actions from"
                value={from}
                onChange={(v) => set("from", v)}
                options={[{ id: "all", label: "Anywhere" }, ...sources.map((x) => ({ id: x, label: sourceNames[x] }))]}
              />
            )}
          </div>
          <ActionList
            open={shown}
            onChange={reload}
            empty={
              <>
                <p className="text-[14px] font-medium">{open.length ? "Nothing here with these filters" : "Nothing left to do"}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {open.length ? (
                    <button
                      type="button"
                      onClick={() =>
                        setParams(
                          (p) => {
                            p.delete("helps");
                            p.delete("from");
                            return p;
                          },
                          { replace: true },
                        )
                      }
                      className="text-fg underline underline-offset-2"
                    >
                      Show every action
                    </button>
                  ) : (
                    "New actions come after each check and site audit."
                  )}
                </p>
              </>
            }
          />
          {plan.data.done.length > 0 && <DoneList done={plan.data.done} onChange={reload} />}
        </>
      )}
    </>
  );
}
