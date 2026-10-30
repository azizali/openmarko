// Skills the user can turn off, edit or add. Module store so the Skills page
// and Marko agree on what's on.

import { useSyncExternalStore } from "react";
import { builtInSkills, type Skill } from "../data/skills";

let skills: Skill[] = builtInSkills;
const listeners = new Set<() => void>();
const set = (next: Skill[]) => { skills = next; listeners.forEach((l) => l()); };
export const useSkills = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => skills, () => skills);

export const skillOn = (id: string) => skills.find((s) => s.id === id)?.enabled ?? false;
export const skillName = (id: string) => skills.find((s) => s.id === id)?.name ?? id;
export function saveSkill(s: Skill) { set(skills.some((x) => x.id === s.id) ? skills.map((x) => (x.id === s.id ? s : x)) : [...skills, s]); }
export function toggleSkill(id: string) { set(skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))); }
export function removeSkill(id: string) { set(skills.filter((s) => s.id !== id || s.builtIn)); }

export const blankSkill = (): Skill => ({
  id: `sk${Date.now().toString(36)}`, name: "", description: "", outputs: "", background: ["voice", "facts"],
  instructions: "- ", example: { ask: "", answer: "" }, builtIn: false, enabled: true, uses30d: 0,
});
