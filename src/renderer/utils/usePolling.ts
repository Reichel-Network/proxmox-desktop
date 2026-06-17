import { useEffect, useRef, useState, useCallback } from 'react';

/** Poll an async function on an interval, with manual refresh + loading/error state. */
export function usePolling<T>(
  fn: () => Promise<T>,
  intervalMs: number,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await fnRef.current();
      if (mounted.current) {
        setData(d);
        setError(null);
      }
    } catch (e: any) {
      if (mounted.current) setError(e?.message || String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh(false);
    if (intervalMs > 0) {
      const id = setInterval(() => refresh(true), intervalMs);
      return () => {
        mounted.current = false;
        clearInterval(id);
      };
    }
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refresh };
}
