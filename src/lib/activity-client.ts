// Client beacon for feature-usage telemetry. Single/Multiple modes are
// local-only (they never touch the server), so this is the only way the admin
// activity log learns they were used.
//
// Deduped once-per-feature-per-browser-session via sessionStorage: a member who
// adds ten receipts in Multiple produces one "used Multiple today" event, not
// ten. Fire-and-forget and guarded — it must never disrupt the user's flow.

import type { ActivityFeature } from "@/lib/activity";

/**
 * Report that the signed-in user completed a meaningful action in a feature.
 * No-op for guests (no account to attribute) and after the first call per
 * session for the same feature+type.
 */
export function logFeatureUsage(feature: ActivityFeature, type = "split.created"): void {
  if (typeof window === "undefined") return;
  const key = `splitzy-activity:${feature}:${type}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage disabled — fall through and just send (best effort).
  }
  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, type }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never throw from telemetry.
  }
}
