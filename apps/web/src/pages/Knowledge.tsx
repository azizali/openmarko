// Knowledge: the Organization's knowledge bases, their documents (pasted, a web page, or an uploaded file), and a
// search to try. Documents are ingested in the background; the list shows where each one is.
import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import { BookOpen, ChevronLeft } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Drawer,
  Field,
  FileInput,
  Input,
  MenuGroup,
  MenuLink,
  NewButton,
  PageHeader,
  RailGroup,
  Select,
  Textarea,
  navRow,
  railGroups,
} from "../components/ui";
import { Table } from "../components/Table";
import { Feedback, useFeedback, useToast } from "../components/Feedback";
import { api, fmtTime, messageOf } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useOrg, useSession } from "../lib/session";

export default function Knowledge() {
  const org = useOrg();
  const { can } = useSession();
  const { baseId } = useParams();
  const navigate = useNavigate();
  const bases = useLoad(() => api.api.v1.organizations({ orgId: org.id }).knowledge.bases.get(), [org.id]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const fb = useFeedback(creating);
  const toast = useToast();
  const wide = useMediaQuery("(min-width: 1024px)");
  const current = bases.data?.find((b) => b.id === baseId);

  // Like Settings: with a rail beside the page, /knowledge opens the first base; on a phone it is the list itself.
  useEffect(() => {
    if (wide && !baseId && bases.data?.[0]) navigate(`/knowledge/${bases.data[0].id}`, { replace: true });
  }, [wide, baseId, bases.data, navigate]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    fb.clear();
    const r = await api.api.v1.organizations({ orgId: org.id }).knowledge.bases.post({ name });
    if (r.error) return fb.fail(messageOf(r.error), "Could not create");
    setCreating(false);
    setName("");
    await bases.reload();
    navigate(`/knowledge/${r.data.id}`);
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this knowledge base and every document in it?")) return;
    const r = await api.api.v1.organizations({ orgId: org.id }).knowledge.bases({ baseId: id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not delete");
    navigate("/knowledge");
    void bases.reload();
  };

  const newButton = can("knowledge", "manage") && <NewButton onClick={() => setCreating(true)}>New knowledge base</NewButton>;
  const empty = bases.data && bases.data.length === 0;
  const list = bases.data ?? [];

  return (
    <>
      {empty ? (
        <>
          <PageHeader title="Knowledge base" sub="Documents your assistants answer from." actions={newButton} />
          <Card>
            <p className="text-[13.5px] text-muted">No knowledge bases yet. Make one, then add documents: text, a web page, or a PDF.</p>
          </Card>
        </>
      ) : !baseId || !current ? (
        // No rail on a phone: the list of bases is the page, one tap from each.
        !wide && (
          <>
            <PageHeader title="Knowledge base" sub="Documents your assistants answer from." actions={newButton} />
            <nav aria-label="Knowledge bases" className="max-w-xl">
              <MenuGroup title="Knowledge bases">
                {list.map((b) => (
                  <MenuLink key={b.id} to={`/knowledge/${b.id}`} icon={<BookOpen size={16} strokeWidth={1.75} />}>
                    {b.name} <span className="num text-[12px] text-subtle">{b.documents}</span>
                  </MenuLink>
                ))}
              </MenuGroup>
            </nav>
          </>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Knowledge bases" className={railGroups}>
            <RailGroup title="Knowledge bases" hint="Documents your assistants answer from">
              {list.map((b) => (
                <NavLink key={b.id} to={`/knowledge/${b.id}`} className={({ isActive }) => navRow(isActive)}>
                  <BookOpen size={14} strokeWidth={1.75} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  <span className="num text-[11.5px] text-subtle">{b.documents}</span>
                </NavLink>
              ))}
            </RailGroup>
            {newButton}
          </nav>
          <div className="min-w-0">
            <Link
              to="/knowledge"
              className="mb-3 -ml-1 inline-flex h-9 items-center gap-0.5 rounded-md pr-2 text-[13px] text-muted hover:text-fg lg:hidden"
            >
              <ChevronLeft size={16} />
              Knowledge base
            </Link>
            <PageHeader title={current.name} sub="Documents your assistants answer from." />
            <Base baseId={baseId} onDelete={() => void remove(baseId)} onChange={() => void bases.reload()} />
          </div>
        </div>
      )}
      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="New knowledge base"
        onSubmit={create}
        feedback={<Feedback {...fb.props} />}
        footer={
          <>
            <Button type="button" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <p className="text-[12.5px] text-subtle">
            Embeddings use the app's default model (openai/text-embedding-3-small). A base never mixes models.
          </p>
        </div>
      </Drawer>
    </>
  );
}

function Base({ baseId, onDelete, onChange }: { baseId: string; onDelete: () => void; onChange: () => void }) {
  const org = useOrg();
  const { can } = useSession();
  const docs = useLoad(() => api.api.v1.organizations({ orgId: org.id }).knowledge.bases({ baseId }).documents.get(), [org.id, baseId]);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<"text" | "markdown" | "url" | "file">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ chunkId: string; documentTitle: string; text: string; score: number }[] | null>(null);
  const addFb = useFeedback(adding);
  const searchFb = useFeedback();
  const toast = useToast();

  // Ingesting runs in the worker: poll while anything is still queued or processing.
  useEffect(() => {
    if (!docs.data?.some((d) => d.status === "queued" || d.status === "processing")) return;
    const t = setInterval(() => void docs.reload(), 2000);
    return () => clearInterval(t);
  }, [docs.data, docs]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    addFb.clear();
    if (kind === "file") {
      if (!file) return;
      const form = new FormData();
      form.set("file", file);
      if (title) form.set("title", title);
      const res = await fetch(`/api/v1/organizations/${org.id}/knowledge/bases/${baseId}/files`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok)
        return addFb.fail(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? "Try again.", "Upload failed");
    } else {
      const r = await api.api.v1
        .organizations({ orgId: org.id })
        .knowledge.bases({ baseId })
        .documents.post(kind === "url" ? { title, kind, url } : { title, kind, content });
      if (r.error) return addFb.fail(messageOf(r.error), "Could not add");
    }
    setAdding(false);
    setTitle("");
    setContent("");
    setUrl("");
    setFile(null);
    void docs.reload();
    onChange();
  };
  const remove = async (id: string) => {
    const r = await api.api.v1.organizations({ orgId: org.id }).knowledge.documents({ documentId: id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not remove");
    void docs.reload();
    onChange();
  };
  const search = async (e: FormEvent) => {
    e.preventDefault();
    searchFb.clear();
    const r = await api.api.v1.organizations({ orgId: org.id }).knowledge.search.post({ baseIds: [baseId], query: q, k: 5 });
    if (r.error) return searchFb.fail(messageOf(r.error), "Could not search");
    setHits(r.data);
  };
  const tone = (s: string) => (s === "ready" ? "good" : s === "failed" ? "bad" : "warn");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-medium">Documents</h2>
        <div className="flex gap-2">
          {can("knowledge", "edit") && <NewButton onClick={() => setAdding(true)}>Add document</NewButton>}
          {can("knowledge", "manage") && (
            <Button variant="ghost" onClick={onDelete}>
              Delete base
            </Button>
          )}
        </div>
      </div>
      <Table
        head={["Title", "Kind", "Status", "Chunks", "Added", ""]}
        empty="No documents yet."
        rows={(docs.data ?? []).map((d) => [
          <span key="t" className="font-medium">
            {d.title}
          </span>,
          d.kind,
          <span key="s">
            <Badge tone={tone(d.status)}>{d.status}</Badge>
            {d.error && <span className="ml-2 text-[12px] text-bad">{d.error}</span>}
          </span>,
          d.chunkCount,
          <span key="a" className="text-muted">
            {fmtTime(d.createdAt as unknown as string)}
          </span>,
          can("knowledge", "edit") ? (
            <Button key="x" size="sm" variant="ghost" onClick={() => void remove(d.id)}>
              Remove
            </Button>
          ) : null,
        ])}
      />
      <Card>
        <CardHeader title="Try a search" sub="By meaning and by words together; the best passages first." />
        <form onSubmit={search} className="flex flex-wrap gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What are the opening hours?"
            required
            className="min-w-0 flex-1"
          />
          <Button type="submit">Search</Button>
          <Feedback {...searchFb.props} className="basis-full" />
        </form>
        {hits && (
          <ul className="mt-4 space-y-2">
            {hits.length === 0 && <li className="text-[13px] text-muted">Nothing matched.</li>}
            {hits.map((h, i) => (
              <li key={h.chunkId} className="rounded-lg bg-hover p-3 text-[13px]">
                <div className="mb-1 flex justify-between text-[12px] text-muted">
                  <span>
                    [{i + 1}] {h.documentTitle}
                  </span>
                  <span className="num">{h.score.toFixed(3)}</span>
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap">{h.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Drawer
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a document"
        onSubmit={add}
        feedback={<Feedback {...addFb.props} />}
        footer={
          <>
            <Button type="button" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="text">Plain text</option>
              <option value="markdown">Markdown</option>
              <option value="url">A web page</option>
              <option value="file">A file (PDF, Markdown, HTML, text)</option>
            </Select>
          </Field>
          <Field label="Title" hint={kind === "file" ? "Empty: the file's name." : undefined}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required={kind !== "file"} />
          </Field>
          {kind === "url" ? (
            <Field label="URL">
              <Input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
          ) : kind === "file" ? (
            <Field label="File">
              <FileInput
                file={file}
                onChange={setFile}
                required
                accept=".pdf,.md,.markdown,.html,.htm,.txt,application/pdf,text/*"
                hint="PDF, Markdown, HTML or text."
              />
            </Field>
          ) : (
            <Field label="Content">
              <Textarea rows={8} required value={content} onChange={(e) => setContent(e.target.value)} />
            </Field>
          )}
        </div>
      </Drawer>
    </div>
  );
}
