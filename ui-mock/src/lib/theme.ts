import { useSyncExternalStore } from "react";

const KEY = "gw-theme";

export type ThemeMode = "light" | "dark" | "system";

// One shared value, so the sidebar toggle and Settings → Appearance agree.
// Kept in memory too, in case storage is blocked.
let current: ThemeMode = (() => {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "light" || s === "dark") return s;
  } catch {}
  return "system";
})();
const listeners = new Set<() => void>();

const isDark = (m: ThemeMode) => (m === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches : m === "dark");

/** Call once before the first render so the page doesn't flash the wrong theme. */
export function applyTheme() {
  document.documentElement.classList.toggle("dark", isDark(current));
}

export function setThemeMode(m: ThemeMode) {
  current = m;
  try { if (m === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, m); } catch {}
  applyTheme();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useThemeMode() {
  return useSyncExternalStore(subscribe, () => current);
}

export function useTheme() {
  const mode = useThemeMode();
  return [isDark(mode), (dark: boolean) => setThemeMode(dark ? "dark" : "light")] as const;
}
