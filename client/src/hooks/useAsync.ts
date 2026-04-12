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
  fnRef.current = fn;

  const execute = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const setData = useCallback((data: T | null) => {
    setState((s) => ({ ...s, data }));
  }, []);

  useEffect(() => {
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, execute, setData };
}
