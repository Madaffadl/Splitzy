"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * SSR-safe localStorage-backed state.
 *
 * Hydration story:
 *   * Server renders with `initialValue` (no `window`).
 *   * Client first render also uses `initialValue` so React hydration matches.
 *   * After mount, the load effect reads localStorage and updates state.
 *
 * Writes happen synchronously inside `setValue` (not via a separate effect),
 * which avoids cascading renders and makes the read-after-write semantics
 * obvious. Reads/writes are best-effort — quota errors and disabled storage
 * are silently ignored so the UI never crashes on them.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const isHydratedRef = useRef(false);

  // Hydrate from localStorage once after mount. Pre-hydration writes are
  // ignored (the load effect would clobber them anyway).
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.warn(`useLocalStorage: failed to load "${key}":`, error);
    }
    isHydratedRef.current = true;
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        // Skip writes before hydration to avoid clobbering with `initialValue`.
        if (isHydratedRef.current) {
          try {
            window.localStorage.setItem(key, JSON.stringify(next));
          } catch (error) {
            console.warn(`useLocalStorage: failed to save "${key}":`, error);
          }
        }
        return next;
      });
    },
    [key]
  );

  const resetValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`useLocalStorage: failed to remove "${key}":`, error);
    }
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, resetValue];
}
