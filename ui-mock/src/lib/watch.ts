// The Organization's watched profiles. Module store so onboarding, the Social
// scanner's Watching tab and its settings share one list.

import { useSyncExternalStore } from "react";
import { seedWatched, type WatchKind, type WatchedProfile } from "../data/watch";
import type { SocialPlatform } from "../data/social";

let list: WatchedProfile[] = seedWatched;
const listeners = new Set<() => void>();
const set = (next: WatchedProfile[]) => { list = next; listeners.forEach((l) => l()); };
export const useWatched = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => list, () => list);

export function watch(platform: SocialPlatform, handle: string, kind: WatchKind, name = "") {
  const h = handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`;
  if (h.length < 2 || list.some((w) => w.platform === platform && w.handle.toLowerCase() === h.toLowerCase())) return;
  set([...list, { id: `w${Date.now().toString(36)}`, platform, handle: h, name: name || (kind === "Competitor" ? "Competitor" : "Inspiration"), kind, followers: 0 }]);
}
export const unwatch = (id: string) => set(list.filter((w) => w.id !== id));
export const setWatched = (next: WatchedProfile[]) => set(next);
