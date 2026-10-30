import { useEffect, useState } from "react";

const KEY = "gw-theme";

function stored(): boolean {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return s === "dark";
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Call once before the first render so the page doesn't flash the wrong theme. */
export function applyTheme() {
  document.documentElement.classList.toggle("dark", stored());
}

export function useTheme() {
  const [dark, setDark] = useState(stored);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem(KEY, dark ? "dark" : "light"); } catch {}
  }, [dark]);
  return [dark, setDark] as const;
}
