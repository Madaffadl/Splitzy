"use client";

import { useLocalStorage, type PersistError } from "@/hooks/useLocalStorage";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hybrid state hook that mirrors the useLocalStorage API.
 * - Guest mode: delegates to useLocalStorage (same behavior as before)
 * - Authenticated mode: still uses localStorage as the primary store for now,
 *   but can be extended to sync with Supabase in the future.
 *
 * The key insight: we preserve the exact same [value, setter, reset] API
 * so pages don't need to change their logic at all. The 4th element reports a
 * failed persist (full or unusable storage) so a page can warn the user rather
 * than let their work quietly stop being saved.
 */
export function useHybridState<T>(
  localKey: string,
  initialValue: T
): [
  T,
  (value: T | ((prev: T) => T)) => void,
  () => void,
  PersistError | null
] {
  // For now, both guest and authenticated users use localStorage
  // as the working state. Authenticated users additionally persist
  // completed receipts to Supabase via the data service (called
  // from the page-level save handlers, not from this hook).
  //
  // This keeps the hook simple and backwards-compatible while still
  // supporting the full auth + backend flow at the application level.
  const [storedValue, setValue, resetValue, persistError] = useLocalStorage<T>(
    localKey,
    initialValue
  );

  return [storedValue, setValue, resetValue, persistError];
}
