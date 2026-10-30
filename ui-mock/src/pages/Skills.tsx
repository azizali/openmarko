import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Drawer, PageHeader, Toggle, cn } from "../components/ui";
import { LogoMark } from "../components/Logo";
import { backgroundLabels, type Background, type Skill } from "../data/skills";
import { blankSkill, removeSkill, saveSkill, toggleSkill, useSkills } from "../lib/skills";

// What Marko knows how to write. Each skill is instructions Marko follows when a
// request matches it, always on top of the brand profile.
export default function Skills() {
  const skills = useSkills();
  const [open, setOpen] = useState<Skill | null>(null);

  return (
    <>
      <PageHeader
        title="Skills"
        sub="What Marko knows how to write. When you ask for something, Marko picks the matching skill and follows its instructions, with your brand voice and business facts in mind."
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(blankSkill())}>New skill</Button>}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4 !py-4">
        <LogoMark size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">Always in the background</div>
          <div className="text-[13px] text-muted">Your brand voice and business facts go with every skill, so a review reply, a TikTok and an article all sound like the same business.</div>
        </div>
        <Link to="/brand"><Button size="sm" variant="ghost">Brand voice</Button></Link>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {skills.map((s) => (
          <Card key={s.id} className={cn("flex flex-col gap-3", !s.enabled && "opacity-60")}>
            <div className="flex items-start gap-3">
              <button onClick={() => setOpen(s)} className="min-w-0 flex-1 text-left">
                <h2 className="text-[15px] font-medium hover:underline">{s.name || "Untitled skill"}</h2>
                <p className="mt-1 mb-0 text-[13px] leading-[1.5] text-muted">{s.description}</p>
              </button>
              <Toggle label={`${s.name} on`} checked={s.enabled} onChange={() => toggleSkill(s.id)} />
            </div>
            <div className="text-[12.5px] text-muted"><span className="text-subtle">Writes: </span>{s.outputs}</div>
            <div className="mt-auto flex flex-wrap items-center gap-1.5">
              {s.background.map((b) => <Badge key={b} tone={b === "voice" ? "accent" : "neutral"}>{backgroundLabels[b]}</Badge>)}
              <span className="num ml-auto text-[12px] text-subtle">{s.builtIn ? `Used ${s.uses30d}× this month` : "Custom"}</span>
            </div>
          </Card>
        ))}
      </div>

      <SkillDrawer skill={open} onClose={() => setOpen(null)} />
    </>
  );
}

function SkillDrawer({ skill, onClose }: { skill: Skill | null; onClose: () => void }) {
  const [s, setS] = useState<Skill | null>(skill);
  useEffect(() => { setS(skill); }, [skill?.id]);
  if (!skill || !s) return null;
  const toggleBg = (b: Background) => setS({ ...s, background: s.background.includes(b) ? s.background.filter((x) => x !== b) : [...s.background, b] });
  const field = "w-full rounded-lg border border-line bg-surface p-3 text-[13.5px] leading-[1.55] outline-none focus:border-line-strong";

  return (
    <Drawer
      open
      onClose={onClose}
      width={640}
      title={skill.builtIn ? skill.name : skill.name || "New skill"}
      footer={<>
        {!skill.builtIn && <Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => { removeSkill(skill.id); onClose(); }}>Delete</Button>}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!s.name.trim()} onClick={() => { saveSkill(s); onClose(); }}>Save</Button>
      </>}
    >
      <div className="flex flex-col gap-5">
        {!skill.builtIn && (
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Name</span>
            <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="e.g. Email newsletters" className={cn(field, "h-10 py-0")} />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">When Marko uses it</span>
          <textarea value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} rows={2} placeholder="e.g. Writing the monthly email to patients." className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Instructions</span>
          <textarea value={s.instructions} onChange={(e) => setS({ ...s, instructions: e.target.value })} rows={11} className={cn(field, "font-mono text-[12.5px]")} />
        </label>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-muted">Background information</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(backgroundLabels) as Background[]).map((b) => (
              <button key={b} onClick={() => b !== "voice" && toggleBg(b)} aria-pressed={s.background.includes(b)} disabled={b === "voice"} title={b === "voice" ? "Every skill uses your brand voice" : undefined} className={cn("h-7 rounded-full border px-2.5 text-[12.5px] transition-colors", s.background.includes(b) ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover", b === "voice" && "cursor-default")}>{backgroundLabels[b]}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-muted">Example</div>
          <div className="overflow-hidden rounded-lg border border-line">
            <input value={s.example.ask} onChange={(e) => setS({ ...s, example: { ...s.example, ask: e.target.value } })} placeholder="What someone asks" aria-label="Example request" className="h-10 w-full border-b border-line bg-hover/50 px-3 text-[13px] outline-none" />
            <textarea value={s.example.answer} onChange={(e) => setS({ ...s, example: { ...s.example, answer: e.target.value } })} rows={5} placeholder="A great answer" aria-label="Example answer" className="w-full resize-y bg-surface p-3 text-[13px] leading-[1.55] outline-none" />
          </div>
        </div>
      </div>
    </Drawer>
  );
}
