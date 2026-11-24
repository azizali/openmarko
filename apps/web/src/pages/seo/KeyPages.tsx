// Site audit → Key pages (/seo/site-audit?view=key-pages): the pages the Location most wants customers to land on,
// each for some tracked keywords, and the links other pages should add to them. One table, a row per key page (its
// keywords, how many pages link to it, the links to add); a row opens what to do about it, as the Action plan card.
// Below, up to three pages worth making key pages, from the page Google shows for a keyword: accept or turn down.
// A member adds or changes one in a side panel. Everything is read from the site audit's crawl.
import { ChevronRight, Plus } from "lucide-react";
import { Fragment, useState, type FormEvent } from "react";
import { Badge, Button, Card, Checkbox, Drawer, Field, FormFooter, Input, cn, fmt } from "../../components/ui";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { fmtDate, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, type KeyPagesView } from "./api";
import { ActionList, DoneList } from "./actions";
import { CheckNowButton, kindsOf, useAfterCheck } from "./checks";
import { stack } from "./parts";
import { useSeo } from "./Seo";

const th = stack.pad;
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
type KeyPage = KeyPagesView["keyPages"][number];
type Editing = { path: string; keywordIds: string[]; existing: boolean };

export default function KeyPages() {
  const { orgId, location, can } = useSeo();
  const page = useLoad(() => locationApi(orgId, location.id).results["key-pages"].get(), [orgId, location.id]);
  useAfterCheck(kindsOf["site-audit"], page.reload);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const reload = async () => void (await page.reload());
  const data = page.data;
  const a = data?.audit;

  if (page.error) return <LoadError what="key pages">{page.error}</LoadError>;
  if (!data || !a) return null;
  if (a.links === 0)
    return (
      <Card>
        <p className="text-[15px] font-medium">Your site's links haven't been read yet</p>
        <p className="mt-1 max-w-[60ch] text-[13.5px] text-muted">
          The audit of {fmtDate(a.checkedAt)} didn't read the links between your pages. Audit again to see which pages link to your key
          pages. It takes a few minutes{can("track") ? "" : ", and runs with the next scheduled check"}.
        </p>
        {can("manage") && (
          <div className="mt-4">
            <CheckNowButton tab="site-audit" />
          </div>
        )}
      </Card>
    );

  const manage = can("track");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-[64ch] text-[13.5px] text-muted">
          The pages you most want customers to land on. Other pages about the same thing should link to them, so Google knows which page to
          show.
        </p>
        {manage && (
          <Button icon={<Plus size={14} />} onClick={() => setEditing({ path: "", keywordIds: [], existing: false })}>
            Add a key page
          </Button>
        )}
      </div>

      {data.keyPages.length === 0 ? (
        <Card>
          <p className="text-[14px] font-medium">No key pages yet</p>
          <p className="mt-1 text-[13px] text-muted">
            {data.ideas.length
              ? "Start with the suggestions below, or add one."
              : "Add the pages that sell what you do: a service, booking, a price list."}
          </p>
        </Card>
      ) : (
        <Card pad={false} className="overflow-x-auto">
          <table role="table" className={stack.table}>
            <thead role="rowgroup" className={stack.head}>
              <tr className="border-b border-line text-left text-[12.5px] text-muted">
                <th className={cn(th, "pl-4")}>Key page</th>
                <th className={th}>For</th>
                <th className={cn(th, "text-right")}>Links in</th>
                <th className={th}>Links to add</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody role="rowgroup" className={stack.body}>
              {data.keyPages.map((k) => {
                const shown = open === k.id;
                return (
                  <Fragment key={k.id}>
                    <tr
                      role="row"
                      className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-hover", stack.row)}
                      onClick={() => setOpen(shown ? null : k.id)}
                    >
                      <td role="cell" className={cn(th, "pl-4", stack.first)}>
                        <button
                          type="button"
                          aria-expanded={shown}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(shown ? null : k.id);
                          }}
                          className="text-left font-medium break-all underline-offset-2 hover:underline"
                        >
                          {k.path}
                        </button>
                        {k.title && <span className="block text-[12px] text-muted">{k.title}</span>}
                      </td>
                      <td role="cell" data-label="For" className={cn(th, "text-[13px]", stack.cell)}>
                        {k.keywords.length ? k.keywords.map((kw) => kw.term).join(", ") : <span className="text-subtle">No keywords</span>}
                      </td>
                      <td role="cell" data-label="Links in" className={cn(th, "num text-right", stack.cell)}>
                        {k.url ? fmt(k.linksIn) : "—"}
                      </td>
                      <td role="cell" data-label="Links to add" className={cn(th, stack.cell)}>
                        <ToAddState k={k} />
                      </td>
                      <td role="cell" className={cn("pr-3", stack.hide)}>
                        <ChevronRight
                          size={15}
                          aria-hidden
                          className={cn("text-subtle transition-transform duration-150", shown && "rotate-90")}
                        />
                      </td>
                    </tr>
                    {shown && (
                      <tr role="row" className="border-b border-line bg-hover/40 last:border-0">
                        <td colSpan={5} className="px-4 py-4">
                          <KeyPageDetail
                            k={k}
                            manage={manage}
                            onChange={reload}
                            onEdit={() => setEditing({ path: k.path, keywordIds: k.keywords.map((kw) => kw.id), existing: true })}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {data.ideas.length > 0 && <Ideas ideas={data.ideas} more={data.moreIdeas} manage={manage} onChange={reload} />}

      <p className="text-[12.5px] text-muted">
        From the audit of {fmtDate(a.checkedAt)}: {plural(a.links, "link", "links")} between {plural(a.pagesCrawled, "page", "pages")}.
      </p>

      <KeyPageDrawer editing={editing} data={data} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}

function ToAddState({ k }: { k: KeyPage }) {
  if (!k.url) return <Badge tone="warn">Not found in the audit</Badge>;
  if (k.toAdd) return <Badge tone="info">{plural(k.from.length, "page", "pages")}</Badge>;
  if (k.done) return <span className="text-[12.5px] text-muted">Marked done</span>;
  if (!k.keywords.length) return <span className="text-[12.5px] text-muted">Pick its keywords</span>;
  return <span className="text-[12.5px] text-good">None needed</span>;
}

/** What to do about one key page: its links to add (the Action plan card), else why there are none. */
function KeyPageDetail({
  k,
  manage,
  onChange,
  onEdit,
}: {
  k: KeyPage;
  manage: boolean;
  onChange: () => Promise<void>;
  onEdit: () => void;
}) {
  const { orgId, location } = useSeo();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    const r = await locationApi(orgId, location.id)["key-pages"]({ keyPageId: k.id }).delete();
    setBusy(false);
    if (r.error) return toast.error(messageOf(r.error), "Could not remove it");
    toast.success(`${k.path} isn't a key page now`);
    await onChange();
  };
  const why = !k.url
    ? "The last site audit didn't find this page. Check its address, or remove it."
    : !k.keywords.length
      ? "Pick the keywords it's for, and the next audit finds the pages that should link to it."
      : k.toAdd || k.done
        ? null
        : "Every page about its keywords links to it already.";
  return (
    <div className="space-y-3">
      {why && <p className="text-[13.5px] text-muted">{why}</p>}
      {k.toAdd && <ActionList open={[k.toAdd]} onChange={onChange} empty={null} />}
      {k.done && <DoneList done={[k.done]} onChange={onChange} />}
      {manage && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onEdit}>
            Change keywords
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void remove()} disabled={busy}>
            Remove key page
          </Button>
        </div>
      )}
    </div>
  );
}

/** Pages worth making key pages: accept or turn down, one at a time. */
function Ideas({
  ideas,
  more,
  manage,
  onChange,
}: {
  ideas: KeyPagesView["ideas"];
  more: number;
  manage: boolean;
  onChange: () => Promise<void>;
}) {
  const { orgId, location } = useSeo();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const api = locationApi(orgId, location.id)["key-pages"];
  const accept = async (i: KeyPagesView["ideas"][number]) => {
    setBusy(i.path);
    const r = await api.put({ path: i.path, keywordIds: i.keywords.map((k) => k.id) });
    setBusy(null);
    if (r.error) return toast.error(messageOf(r.error), "Could not add it");
    toast.success(`${i.path} is a key page`);
    await onChange();
  };
  const decline = async (path: string) => {
    setBusy(path);
    const r = await api.decline.post({ path });
    setBusy(null);
    if (r.error) return toast.error(messageOf(r.error), "Could not turn it down");
    await onChange();
  };
  const quote = (terms: string[]) => terms.map((t) => `“${t}”`).join(" and ");
  return (
    <section aria-labelledby="key-page-ideas">
      <h2 id="key-page-ideas" className="mb-3 text-[15px] font-medium">
        Suggested key pages
      </h2>
      <div className="space-y-3">
        {ideas.map((i) => {
          const terms = quote(i.keywords.map((k) => k.term));
          return (
            <Card key={i.path}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium break-all">{i.path}</p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {i.shownByGoogle ? `Google shows it for ${terms}.` : `Your page most about ${terms}.`}
                  </p>
                </div>
                {manage && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="primary" onClick={() => void accept(i)} disabled={!!busy}>
                      Make it a key page
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void decline(i.path)} disabled={!!busy}>
                      No
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {more > 0 && <p className="mt-2 text-[12.5px] text-muted">{plural(more, "more comes", "more come")} when you've decided on these.</p>}
    </section>
  );
}

/** Adding a key page, or changing one's keywords: the page (from the crawl) and the tracked keywords it's for. */
function KeyPageDrawer({
  editing,
  data,
  onClose,
  onSaved,
}: {
  editing: Editing | null;
  data: KeyPagesView;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { orgId, location } = useSeo();
  const toast = useToast();
  const fb = useFeedback(editing);
  const [path, setPath] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<Editing | null>(null);
  // A new panel starts from what it was opened with.
  if (editing !== seen) {
    setSeen(editing);
    setPath(editing?.path ?? "");
    setPicked(editing?.keywordIds ?? []);
  }
  const owner = new Map(data.keyPages.map((k) => [k.id, k.path]));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;
    setBusy(true);
    const r = await locationApi(orgId, location.id)["key-pages"].put({ path: path.trim(), keywordIds: picked });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error));
    toast.success(editing?.existing ? "Saved" : `${path.trim()} is a key page`);
    onClose();
    await onSaved();
  };
  return (
    <Drawer
      open={!!editing}
      onClose={onClose}
      title={editing?.existing ? editing.path : "Add a key page"}
      onSubmit={save}
      feedback={<Feedback {...fb.props} />}
      footer={
        <FormFooter onCancel={onClose} disabled={busy || !path.trim()} action={busy ? "Saving…" : editing?.existing ? "Save" : "Add"} />
      }
    >
      {!editing?.existing && (
        <Field label="Page" hint="Its address on your website, like /services. Pick from the pages the audit found, or type one.">
          <Input value={path} onChange={(e) => setPath(e.target.value)} list="key-page-paths" placeholder="/services" autoFocus />
          <datalist id="key-page-paths">
            {data.pages.map((p) => (
              <option key={p.path} value={p.path}>
                {p.title ?? ""}
              </option>
            ))}
          </datalist>
        </Field>
      )}
      <fieldset className={cn(!editing?.existing && "mt-5")}>
        <legend className="mb-1.5 text-[12.5px] font-medium text-muted">The keywords it should rank for</legend>
        {data.keywords.length === 0 ? (
          <p className="text-[13px] text-muted">Track keywords on Google search first, then pick them here.</p>
        ) : (
          <ul className="space-y-1">
            {data.keywords.map((kw) => {
              const other = kw.keyPageId && owner.get(kw.keyPageId) !== editing?.path ? owner.get(kw.keyPageId) : null;
              const on = picked.includes(kw.id);
              return (
                <li key={kw.id}>
                  <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[13.5px]">
                    <Checkbox checked={on} onChange={(v) => setPicked(v ? [...picked, kw.id] : picked.filter((id) => id !== kw.id))} />
                    <span className="min-w-0 flex-1 truncate">{kw.term}</span>
                    {other && <span className="shrink-0 text-[12px] text-muted">{on ? `moves from ${other}` : `on ${other}`}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
    </Drawer>
  );
}
