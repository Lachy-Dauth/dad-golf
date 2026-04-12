import { useState, useEffect, useCallback, useRef } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> & { execute: () => Promise<void>; setData: (data: T | null) => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const fnRef = useRef(fn);
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  fnRef.current = fn;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (isMountedRef.current) {
      setState((s) => ({ ...s, loading: true, error: null }));
    }
    try {
      const data = await fnRef.current();
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      setState({ data, loading: false, error: null });
    } catch (e) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      setState({ data: null, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const setData = useCallback((data: T | null) => {
    if (!isMountedRef.current) return;
    setState((s) => ({ ...s, data }));
  }, []);

  useEffect(() => {
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, execute, setData };
}
