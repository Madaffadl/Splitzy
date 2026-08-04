"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Captures ?ref=CODE from any page URL and stores it as a cookie so the
// server-side auth callback can read it when the user signs up.
export function RefCapture() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && /^[A-Z0-9]{6,10}$/.test(ref)) {
      document.cookie = `splitzy_ref=${ref};path=/;max-age=2592000;SameSite=Lax`;
    }
  }, [searchParams]);
  return null;
}
