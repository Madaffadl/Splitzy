"use client";

import { useCallback, useEffect, useState } from "react";
import type { SettlementTransfer } from "@/types";

/**
 * Tracks which settlements have been marked as "paid" by the user.
 *
 * Local-only by design — settle-up is a UX affordance ("I sent the transfer,
 * cross it off the list") and does not need to be authoritative or synced
 * across devices in this iteration. A future server-side version can extend
 * this hook without changing the call sites.
 *
 * @param scope    Stable namespace (e.g. `receipt:<id>` or `trip:<id>`) so
 *                 that paid markers don't bleed across different splits.
 */
export function usePaidSettlements(scope: string) {
  const storageKey = `splitzy-paid:${scope}`;
  const [paid, setPaid] = useState<Set<string>>(() => new Set());

  // Hydrate from localStorage on mount (and when scope changes).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setPaid(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setPaid(new Set());
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: Set<string>) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Quota or privacy-mode failures are non-critical; UI state still updates.
      }
    },
    [storageKey]
  );

  const togglePaid = useCallback(
    (key: string) => {
      setPaid((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const isPaid = useCallback((key: string) => paid.has(key), [paid]);

  return { paid, isPaid, togglePaid };
}

/**
 * Stable identifier for a settlement transfer. Amount is rounded to 2dp to
 * tolerate float jitter when totals recompute.
 */
export function settlementKey(s: SettlementTransfer): string {
  return `${s.from}>${s.to}:${Math.round(s.amount * 100)}`;
}
