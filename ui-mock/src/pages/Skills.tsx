import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, BadgeCheck, Download, Lock, Plus, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, Drawer, Empty, Modal, PageHeader, SearchInput, Segmented, Tabs, Textarea, Toggle, cn, fmt, useToast } from "../components/ui";
import { LogoMark } from "../components/Logo";
import { backgroundLabels, parseSkillMd, publicSkills, type PublicSkill, type Skill } from "../data/skills";
import { assistant, product, whitelabeled } from "../lib/whitelabel";
import { addPublicSkill, blankSkillMd, installed, isEdited, original, removeSkill, resetSkill, saveProblem, saveSkill, toggleSkill, useSkills } from "../lib/skills";

type Filter = "all" | "builtin" | "custom" | "public";
/** What the editor has open: an existing skill by id, or a new file (id null). */
type Open = { id: string | null; md: string };

// Our own publisher handle names us, so whitelabeled sessions see the product name instead.
const publisher = (handle: string) => (whitelabeled() ? handle.replace(/^openmarko\b/i, product()) : handle);
const sourceLabel = (s: Skill) => (s.source.kind === "builtin" ? "Built-in" : s.source.kind === "custom" ? "Custom" : publisher(s.source.author));

// What Marko knows how to write. Each skill is a SKILL.md file Marko follows
// when a request matches its description, always on top of the brand profile.
// Built-in skills ship with OpenMarko (some locked), public ones are added from
// the public index, and custom ones are written here or uploaded.
export default function Skills() {
  const skills = useSkills();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Open | null>(null);
  const [browse, setBrowse] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { toast, node } = useToast();
  const count = (k: Filter) => skills.filter((s) => k === "all" || s.source.kind === k).length;
  const shown = skills.filter((s) => filter === "all" || s.source.kind === filter);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setOpen({ id: null, md: await f.text() });
    if (file.current) file.current.value = "";
  };

  return (
    <>
      <PageHeader
        title={`${assistant()} skills`}
        sub={`What ${assistant()} knows how to write. Each skill is a SKILL.md file: when you ask for something, ${assistant()} picks the matching skill and follows it, with your brand voice and business facts in mind.`}
        actions={<>
          <Button icon={<Search size={14} />} onClick={() => setBrowse(true)}>Browse public skills</Button>
          <Button variant="ghost" icon={<Upload size={14} />} onClick={() => file.current?.click()}>Upload .md</Button>
          <input ref={file} type="file" accept=".md,text/markdown" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen({ id: null, md: blankSkillMd })}>New skill</Button>
        </>}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4 !py-4">
        <LogoMark size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">Always in the background</div>
          <div className="text-[13px] text-muted">Your brand voice and business facts go with every skill, so a review reply, a TikTok and an article all sound like the same business.</div>
        </div>
        <Link to="/settings/brand"><Button size="sm" variant="ghost">Brand voice</Button></Link>
      </Card>

      <div className="max-w-4xl">
        <div className="mb-4">
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: "all", label: "All", count: count("all") },
              { id: "builtin", label: "Built-in", count: count("builtin") },
              { id: "public", label: "Public", count: count("public") },
              { id: "custom", label: "Custom", count: count("custom") },
            ]}
          />
        </div>
        <Card pad={false}>
          {shown.length === 0 && (
            <Empty
              icon={<Search size={22} />}
              title={filter === "public" ? "No public skills yet" : "No custom skills yet"}
              sub={filter === "public" ? "Search skills other people have published and add them here." : "Write a SKILL.md here or upload one."}
              action={filter === "public" ? <Button onClick={() => setBrowse(true)}>Browse public skills</Button> : <Button onClick={() => setOpen({ id: null, md: blankSkillMd })}>New skill</Button>}
            />
          )}
          {shown.map((s, i) => (
            <div key={s.id} className={cn("flex items-start gap-4 px-5 py-4", i > 0 && "border-t border-line", !s.enabled && "opacity-60")}>
              <button onClick={() => setOpen({ id: s.id, md: s.md })} className="group min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-medium group-hover:underline">{s.name}</span>
                  <code className="text-[11.5px] text-subtle">{s.id}</code>
                  <Badge tone={s.source.kind === "builtin" ? "neutral" : "info"}>{sourceLabel(s)}</Badge>
                  {s.locked && <Badge tone="warn"><Lock size={10} />Locked</Badge>}
                  {isEdited(s) && <Badge>Edited</Badge>}
                </div>
                <p className="mt-1 mb-0 text-[13px] leading-[1.5] text-muted">{s.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {s.background.map((b) => <Badge key={b} tone={b === "voice" ? "accent" : "neutral"}>{backgroundLabels[b]}</Badge>)}
                  <span className="num ml-auto text-[12px] text-subtle">{s.uses30d ? `Used ${s.uses30d}× this month` : "Not used yet"}</span>
                </div>
              </button>
              <Toggle label={`${s.name} on`} checked={s.enabled} onChange={() => toggleSkill(s.id)} />
            </div>
          ))}
        </Card>
      </div>

      {open && <SkillEditor key={open.id ?? open.md} open={open} onClose={() => setOpen(null)} onSaved={(msg) => { setOpen(null); toast(msg); }} />}
      <PublicSkills open={browse} onClose={() => setBrowse(false)} onAdded={(name) => { setBrowse(false); toast(`Added ${name}. It's on.`); }} />
      {node}
    </>
  );
}

const download = (id: string, md: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
  a.download = `${id || "skill"}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
};

/** The SKILL.md editor. Locked skills open read-only. */
function SkillEditor({ open, onClose, onSaved }: { open: Open; onClose: () => void; onSaved: (msg: string) => void }) {
  const skills = useSkills();
  const skill = open.id ? skills.find((s) => s.id === open.id) : undefined;
  const [md, setMd] = useState(skill?.md ?? open.md);
  const [view, setView] = useState<"edit" | "preview">(skill?.locked ? "preview" : "edit");
  const parsed = useMemo(() => parseSkillMd(md), [md]);
  const problems = "errors" in parsed ? parsed.errors : [saveProblem(open.id, parsed.skill)].filter((p): p is string => !!p);
  const readOnly = !!skill?.locked;
  const changed = md !== (skill?.md ?? open.md) || !skill;

  const save = () => {
    if (!("skill" in parsed) || problems.length) return;
    saveSkill(open.id, parsed.skill);
    onSaved(skill ? `Saved ${parsed.skill.name}` : `Added ${parsed.skill.name}`);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={720}
      title={<span className="flex items-center gap-2">{skill?.name ?? "New skill"}{skill && <code className="text-[12px] font-normal text-subtle">{skill.id}/SKILL.md</code>}</span>}
      footer={<>
        {skill && skill.source.kind !== "builtin" && <Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => { removeSkill(skill.id); onSaved(`Deleted ${skill.name}`); }}>Delete</Button>}
        {skill && isEdited(skill) && <Button variant="ghost" icon={<RotateCcw size={13} />} onClick={() => { resetSkill(skill.id); setMd(original(skill.id)!.md); }}>Reset to default</Button>}
        <Button variant="ghost" icon={<Download size={13} />} onClick={() => download(skill?.id ?? ("skill" in parsed ? parsed.skill.id : ""), md)}>Download</Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>
        {!readOnly && <Button variant="primary" disabled={!changed || problems.length > 0} onClick={save}>{skill ? "Save" : "Add skill"}</Button>}
      </>}
    >
      <div className="flex flex-col gap-4">
        {skill?.locked && (
          <div className="flex gap-2.5 rounded-lg border border-line bg-hover/50 p-3 text-[13px]">
            <Lock size={14} className="mt-0.5 shrink-0 text-muted" />
            <div><span className="font-medium">Locked by {product()}.</span> <span className="text-muted">{skill.locked} You can still turn it off.</span></div>
          </div>
        )}
        {skill?.source.kind === "public" && (
          <div className="text-[12.5px] text-muted">From <span className="font-medium text-fg">{publisher(skill.source.repo)}</span> · v{skill.source.version}. This is your copy; edits stay here.</div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Segmented label="View" value={view} onChange={setView} options={[{ id: "edit", label: readOnly ? "Source" : "Edit" }, { id: "preview", label: "Preview" }]} />
          <span className="text-[12px] text-subtle">Frontmatter: name, description, background ({Object.keys(backgroundLabels).join(", ")})</span>
        </div>
        {view === "edit" ? (
          <Textarea mono value={md} onChange={(e) => setMd(e.target.value)} readOnly={readOnly} spellCheck={false} aria-label="SKILL.md" rows={26} className={cn(readOnly && "text-muted")} />
        ) : (
          <div className="rounded-lg border border-line p-4"><MdPreview md={md} /></div>
        )}
        {problems.length > 0 && md !== blankSkillMd && (
          <ul className="m-0 list-none space-y-1 rounded-lg border border-line p-3 text-[12.5px] text-bad">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>
    </Drawer>
  );
}

/** Search the public skill index and add a copy. */
function PublicSkills({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (name: string) => void }) {
  useSkills();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<PublicSkill | null>(null);
  const rows = useMemo(() => publicSkills.flatMap((p) => {
    const r = parseSkillMd(p.md);
    return "skill" in r ? [{ p, s: r.skill }] : [];
  }), []);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = rows.filter(({ p, s }) => terms.every((t) => `${s.name} ${s.id} ${s.description} ${p.repo}`.toLowerCase().includes(t)));
  const pickedSkill = picked && rows.find((r) => r.p === picked)?.s;
  const add = (p: PublicSkill, name: string) => { if (addPublicSkill(p)) { setPicked(null); setQ(""); onAdded(name); } };
  const close = () => { setPicked(null); onClose(); };

  return (
    <Modal
      open={open}
      onClose={close}
      width={720}
      title={pickedSkill ? pickedSkill.name : "Public skills"}
      footer={picked && pickedSkill ? <>
        <Button variant="ghost" icon={<ArrowLeft size={13} />} onClick={() => setPicked(null)}>Back</Button>
        <span className="flex-1" />
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => add(picked, pickedSkill.name)}>{installed(picked) ? "Add another copy" : "Add skill"}</Button>
      </> : undefined}
    >
      {picked && pickedSkill ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span className="font-medium text-fg">{publisher(picked.repo)}</span>
            {picked.verified && <Badge tone="good"><BadgeCheck size={10} />Verified publisher</Badge>}
            <span>v{picked.version}</span>
            <span className="num">· {fmt(picked.installs)} installs</span>
          </div>
          {!picked.verified && <p className="m-0 text-[12.5px] text-muted">Skills are instructions {assistant()} follows. Read this one before adding it, since this publisher isn't verified.</p>}
          <pre className="m-0 max-h-[50vh] overflow-auto rounded-lg border border-line bg-hover/40 p-3 font-mono text-[12px] leading-[1.6] whitespace-pre-wrap">{picked.md}</pre>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <SearchInput size="lg" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills: newsletter, ads, hiring…" aria-label="Search public skills" />
          {hits.length === 0 && <p className="py-8 text-center text-[13px] text-muted">No public skills match “{q}”.</p>}
          <div className="divide-y divide-line">
            {hits.map(({ p, s }) => (
              <div key={`${p.repo}/${s.id}`} className="flex items-start gap-3 py-3">
                <button onClick={() => setPicked(p)} className="group min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium group-hover:underline">{s.name}</span>
                    {p.verified && <BadgeCheck size={13} className="text-good" aria-label="Verified publisher" />}
                    <span className="text-[12px] text-subtle">{publisher(p.repo)} · v{p.version}</span>
                  </div>
                  <p className="mt-0.5 mb-0 text-[13px] text-muted">{s.description}</p>
                  <span className="num text-[12px] text-subtle">{fmt(p.installs)} installs</span>
                </button>
                {installed(p) ? <Badge>Added</Badge> : <Button size="sm" onClick={() => setPicked(p)}>View</Button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Just enough markdown for a SKILL.md: headings, nested lists, paragraphs, **bold**. */
function MdPreview({ md }: { md: string }) {
  const body = md.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const inline = (t: string) => t.split(/(\*\*[^*]+\*\*)/).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
  const out: ReactNode[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) out.push(<p key={out.length} className="my-2 text-[13.5px] leading-[1.6] whitespace-pre-line">{inline(para.join("\n"))}</p>); para = []; };
  for (const line of body.split("\n")) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const li = line.match(/^(\s*)-\s+(.*)$/);
    if (h) { flush(); out.push(h[1].length === 1 ? <h2 key={out.length} className="mt-0 mb-2 font-serif text-[22px]">{h[2]}</h2> : <h3 key={out.length} className="mt-4 mb-1.5 text-[14px] font-medium">{h[2]}</h3>); }
    else if (li) { flush(); out.push(<div key={out.length} className="flex gap-2 text-[13.5px] leading-[1.6]" style={{ paddingLeft: li[1].length * 8 }}><span className="text-subtle">•</span><span>{inline(li[2])}</span></div>); }
    else if (!line.trim()) flush();
    else para.push(line);
  }
  flush();
  return <div>{out}</div>;
}
