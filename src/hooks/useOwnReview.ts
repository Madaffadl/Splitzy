"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReviewSource } from "@/lib/validation";

export interface OwnReview {
  id: string;
  rating: number;
  body: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The caller's own review, plus a submit action.
 *
 * `loaded` is deliberately separate from `review`. The primary case for both
 * entry points is a user who has *no* review yet, and that arrives as a
 * successful `{ review: null }` — collapsing the two into one nullable value
 * (as ReferralCard does) would hide the card from exactly the people it exists
 * to reach.
 */
export function useOwnReview() {
  const [review, setReview] = useState<OwnReview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { review: OwnReview | null }) => {
        if (!active) return;
        setReview(data.review);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = useCallback(
    async (input: {
      rating: number;
      body: string | null;
      source: ReviewSource;
      locale: string;
    }): Promise<{ ok: true } | { ok: false; error: string }> => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
        }
        setReview(data.review as OwnReview);
        return { ok: true };
      } catch {
        return { ok: false, error: "network" };
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  return { review, loaded, failed, submitting, submit };
}
