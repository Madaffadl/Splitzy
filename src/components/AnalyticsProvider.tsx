"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { capturePageview } from "@/lib/analytics";

// Sends an SPA pageview on every route change. No-ops entirely when analytics
// is disabled (no PostHog key). Rendered once in the root layout.
export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    capturePageview(pathname);
  }, [pathname]);

  return null;
}
