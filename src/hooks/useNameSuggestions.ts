"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "splitzy-name-history";
const MAX_HISTORY = 30;

interface NameRecord {
  name: string;
  // How many times this name has been added — frequent contacts surface first.
  count: number;
  // Last time the name was used — used as tie-breaker so recent matches rank above stale ones.
  lastUsed: number;
}

function loadAll(): NameRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is NameRecord =>
        r &&
        typeof r === "object" &&
        typeof r.name === "string" &&
        typeof r.count === "number" &&
        typeof r.lastUsed === "number"
    );
  } catch {
    return [];
  }
}

function persist(records: NameRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Quota errors are non-critical — autocomplete just won't grow.
  }
}

/**
 * Tracks names the user has previously added (across split sessions) and
 * exposes case-insensitive prefix suggestions for an Input. Stored locally
 * only — this is a UX affordance, not a contact book.
 */
export function useNameSuggestions(currentNames: string[]) {
  const [history, setHistory] = useState<NameRecord[]>([]);

  useEffect(() => {
    setHistory(loadAll());
  }, []);

  /** Record that a name was added — increments count + bumps lastUsed. */
  const recordName = useCallback((rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    setHistory((prev) => {
      const existing = prev.find(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      let next: NameRecord[];
      if (existing) {
        next = prev.map((r) =>
          r === existing
            ? { ...r, count: r.count + 1, lastUsed: Date.now() }
            : r
        );
      } else {
        next = [...prev, { name, count: 1, lastUsed: Date.now() }];
      }
      // Keep top-N by recency × frequency to bound storage.
      next = next
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, MAX_HISTORY);
      persist(next);
      return next;
    });
  }, []);

  /**
   * Suggestions for the given query string. Excludes names already in
   * `currentNames` (case-insensitive) so the user doesn't see options that
   * would just trigger the duplicate-error.
   */
  const suggestionsFor = useCallback(
    (query: string, max: number = 5): string[] => {
      const q = query.trim().toLowerCase();
      const taken = new Set(currentNames.map((n) => n.toLowerCase()));

      const candidates = history.filter(
        (r) => !taken.has(r.name.toLowerCase())
      );

      if (!q) {
        // Empty query → show most-recent-most-frequent regardless of prefix.
        return candidates
          .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
          .slice(0, max)
          .map((r) => r.name);
      }

      return candidates
        .filter((r) => r.name.toLowerCase().includes(q))
        .sort((a, b) => {
          // Prefix matches rank above contains-only matches.
          const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
          if (aPrefix !== bPrefix) return aPrefix - bPrefix;
          return b.count - a.count || b.lastUsed - a.lastUsed;
        })
        .slice(0, max)
        .map((r) => r.name);
    },
    [history, currentNames]
  );

  return { recordName, suggestionsFor };
}
