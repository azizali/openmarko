import { useCallback, useEffect, useState } from "react";
import { messageOf } from "./api";

/** Loads something once, and again on reload(). `error` is a message to show. */
export function useLoad<T>(load: () => Promise<{ data: T | null; error: unknown }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const res = await load();
    if (res.error) setError(messageOf(res.error as { value?: unknown; status?: number }));
    else {
      setError(null);
      setData(res.data);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
