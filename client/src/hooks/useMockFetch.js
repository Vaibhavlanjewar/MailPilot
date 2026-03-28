import { useState, useEffect, useCallback } from 'react';
import { mockRequest } from '../services/api';

/**
 * @template T
 * @param {() => Promise<T>} getPromise
 * @param {unknown[]} deps
 */
export function useMockFetch(getPromise, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPromise();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getPromise();
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass deps explicitly
  }, deps);

  return { data, loading, error, refetch };
}

/**
 * @template T
 * @param {T} staticData
 * @param {number} [ms]
 */
export function useDelayedMock(staticData, ms = 650) {
  return useMockFetch(() => mockRequest(staticData, ms), [staticData, ms]);
}
