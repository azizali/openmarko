// Skills the user can turn off, edit, add from the public index or write
// themselves. Module store so the Skills page and Marko agree on what's on.
// Locked skills can only be turned on or off.

import { useSyncExternalStore } from "react";
import { builtInSkills, parseSkillMd, type ParsedSkill, type PublicSkill, type Skill } from "../data/skills";

let skills: Skill[] = builtInSkills;
const listeners = new Set<() => void>();
const set = (next: Skill[]) => { skills = next; listeners.forEach((l) => l()); };
export const useSkills = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => skills, () => skills);

export const skillOn = (id: string) => skills.find((s) => s.id === id)?.enabled ?? false;
export const skillName = (id: string) => skills.find((s) => s.id === id)?.name ?? id;
export function toggleSkill(id: string) { set(skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))); }
export function removeSkill(id: string) { set(skills.filter((s) => s.id !== id || s.source.kind === "builtin")); }

/** Saves an edited or new SKILL.md. `id` is the skill being edited, or null for a new one. */
export function saveSkill(id: string | null, p: ParsedSkill) {
  const cur = id ? skills.find((s) => s.id === id) : undefined;
  if (cur?.locked) return;
  if (cur) set(skills.map((s) => (s.id === id ? { ...s, ...p, id: s.id } : s)));
  else set([...skills, { ...p, source: { kind: "custom" }, enabled: true, uses30d: 0 }]);
}

/** Why this SKILL.md can't be saved over `id` (null for a new skill), besides parse errors. */
export function saveProblem(id: string | null, p: ParsedSkill): string | null {
  if (id && p.id !== id) return `The name can't change once a skill is added. Keep name: ${id}`;
  if (!id && skills.some((s) => s.id === p.id)) return `There's already a skill named ${p.id}. Pick another name.`;
  return null;
}

/** The built-in version of a skill, when it has one. */
export const original = (id: string) => builtInSkills.find((s) => s.id === id);
export const isEdited = (s: Skill) => s.source.kind === "builtin" && original(s.id)?.md !== s.md;
export function resetSkill(id: string) { const o = original(id); if (o) set(skills.map((s) => (s.id === id ? { ...o, enabled: s.enabled, uses30d: s.uses30d } : s))); }

export const installed = (p: PublicSkill) => skills.some((s) => s.source.kind === "public" && s.source.repo === p.repo && s.id === skillId(p));
const skillId = (p: PublicSkill) => { const r = parseSkillMd(p.md); return "skill" in r ? r.skill.id : ""; };

/** Copies a public skill in, pinned to its version. A name clash gets a suffix. Returns the new skill's id. */
export function addPublicSkill(p: PublicSkill): string | null {
  const r = parseSkillMd(p.md);
  if ("errors" in r) return null;
  let id = r.skill.id;
  for (let n = 2; skills.some((s) => s.id === id); n++) id = `${r.skill.id}-${n}`;
  const md = id === r.skill.id ? p.md : p.md.replace(/^name:.*$/m, `name: ${id}`);
  set([...skills, { ...r.skill, id, md, source: { kind: "public", author: p.author, repo: p.repo, version: p.version }, enabled: true, uses30d: 0 }]);
  return id;
}

export const blankSkillMd = `---
name:
description:
background: [voice, facts]
---
#

Writes

## Instructions
-

## Example
**Ask:**

**Answer:**
`;
