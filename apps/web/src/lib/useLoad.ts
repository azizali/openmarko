import { useCallback, useEffect, useRef, useState } from "react";
import { messageOf } from "./api";

/**
 * Loads something once, again when `deps` change, and again on reload(). `error` is a message to show. Only the
 * newest request may set the state, so a slow answer never replaces a newer one; when `deps` change, what was
 * shown for the old ones is cleared at once rather than left on screen until the new answer arrives.
 */
export function useLoad<T>(load: () => Promise<{ data: T | null; error: unknown }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++seq.current;
    const res = await load();
    if (mine !== seq.current) return;
    if (res.error) setError(messageOf(res.error as { value?: unknown; status?: number }));
    else {
      setError(null);
      setData(res.data);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(true);
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
