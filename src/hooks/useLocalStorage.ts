"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Why a write failed. Callers use this to tell the user what they lost:
 *   * "quota"       — storage is full; the in-memory session still works but
 *                     nothing will survive a reload until space is freed.
 *   * "unavailable" — storage is blocked entirely (Safari private mode,
 *                     disabled cookies/site data, sandboxed iframe).
 */
export type PersistErrorKind = "quota" | "unavailable";

export interface PersistError {
  kind: PersistErrorKind;
  /** The storage key that failed to save. */
  key: string;
  /** Epoch ms — lets callers de-duplicate repeated toasts. */
  at: number;
}

/**
 * A failed write is either "storage is full" or "storage is unusable". Browsers
 * disagree on how they say it: Chrome/Edge throw DOMException
 * "QuotaExceededError" (legacy code 22), Firefox "NS_ERROR_DOM_QUOTA_REACHED"
 * (code 1014), Safari sometimes only sets the code.
 */
export function classifyPersistError(error: unknown): PersistErrorKind {
  if (error instanceof DOMException) {
    if (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014
    ) {
      return "quota";
    }
  }
  return "unavailable";
}

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
 * obvious. A write failure never throws — the in-memory value is always
 * updated so the UI keeps working — but it IS reported through the 4th tuple
 * element so the page can warn the user their work is not being saved.
 * Silently swallowing this was losing whole receipts without a word.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [
  T,
  (value: T | ((prev: T) => T)) => void,
  () => void,
  PersistError | null
] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [persistError, setPersistError] = useState<PersistError | null>(null);
  const isHydratedRef = useRef(false);
  // Mirrors `storedValue` synchronously so `setValue` can resolve a functional
  // updater (and serialise the result) outside React's state updater, where
  // calling another setState would be unsafe.
  const valueRef = useRef<T>(initialValue);

  // Hydrate from localStorage once after mount. Pre-hydration writes are
  // ignored (the load effect would clobber them anyway).
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        const parsed = JSON.parse(item) as T;
        valueRef.current = parsed;
        setStoredValue(parsed);
      }
    } catch (error) {
      console.warn(`useLocalStorage: failed to load "${key}":`, error);
    }
    isHydratedRef.current = true;
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const next =
        value instanceof Function
          ? (value as (prev: T) => T)(valueRef.current)
          : value;
      valueRef.current = next;
      setStoredValue(next);

      // Skip writes before hydration to avoid clobbering with `initialValue`.
      if (!isHydratedRef.current) return;

      try {
        window.localStorage.setItem(key, JSON.stringify(next));
        // Clear a stale warning once a write succeeds again (e.g. the user
        // deleted an old trip and freed up space).
        setPersistError((prev) => (prev === null ? prev : null));
      } catch (error) {
        console.warn(`useLocalStorage: failed to save "${key}":`, error);
        setPersistError({
          kind: classifyPersistError(error),
          key,
          at: Date.now(),
        });
      }
    },
    [key]
  );

  const resetValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`useLocalStorage: failed to remove "${key}":`, error);
    }
    valueRef.current = initialValue;
    setStoredValue(initialValue);
    setPersistError(null);
  }, [key, initialValue]);

  return [storedValue, setValue, resetValue, persistError];
}
