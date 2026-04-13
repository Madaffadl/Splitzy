"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

const GUEST_LIMIT_KEY = "splitzy-guest-splits-count";
const MAX_GUEST_SPLITS = 3;

export function useGuestLimit() {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GUEST_LIMIT_KEY);
      if (stored) {
        setCount(parseInt(stored, 10) || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  const incrementCount = useCallback(() => {
    if (isAuthenticated) return; // no limit for authenticated users

    const newCount = count + 1;
    setCount(newCount);
    try {
      window.localStorage.setItem(GUEST_LIMIT_KEY, newCount.toString());
    } catch {
      // ignore
    }
  }, [count, isAuthenticated]);

  return {
    count,
    splitsRemaining: isAuthenticated
      ? Infinity
      : Math.max(0, MAX_GUEST_SPLITS - count),
    isLimitReached: !isAuthenticated && count >= MAX_GUEST_SPLITS,
    shouldPromptLogin: !isAuthenticated && count >= MAX_GUEST_SPLITS,
    incrementCount,
    maxSplits: MAX_GUEST_SPLITS,
  };
}
