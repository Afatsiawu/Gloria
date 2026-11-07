import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Small data-fetching hook with abort support and a manual reload counter.
 * Keeps pages light: no external query library is shipped to the browser.
 */
export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api(path, { signal: controller.signal })
      .then((result) => {
        if (mounted.current) setData(result);
      })
      .catch((err) => {
        if (err.name !== 'AbortError' && mounted.current) setError(err);
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload, setData };
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · PharmaLink` : 'PharmaLink · Doryumu & Kordibe pharmacies';
  }, [title]);
}

export function usePolling(callback, intervalMs, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') callback();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [callback, intervalMs, active]);
}
