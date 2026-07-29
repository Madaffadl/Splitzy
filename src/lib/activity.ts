// Shared vocabulary for the user activity log (see the ActivityEvent model).
// Pure (no DB, no React) so it can be imported by the client beacon, the server
// logger, and the admin UI without dragging Prisma into the client bundle.

export type ActivityFeature = "single" | "multiple" | "travel" | "account";

export interface ActivityEntry {
  id: string;
  userEmail: string;
  feature: ActivityFeature | string;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Product features a client beacon may report (login lives under "account" and
// is only ever written server-side, so it is intentionally excluded here).
export const BEACON_FEATURES: readonly ActivityFeature[] = ["single", "multiple", "travel"];

// Event slugs a client beacon may report. Bounded allowlist — anything else is
// rejected so a tampered client can't write arbitrary strings into the log.
export const BEACON_TYPES: readonly string[] = ["split.created", "share.created", "receipt.added"];

/** Validate an untrusted beacon body. Returns the normalized pair or null. */
export function parseBeacon(
  body: unknown
): { feature: ActivityFeature; type: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const feature = b.feature;
  const type = b.type;
  if (typeof feature !== "string" || typeof type !== "string") return null;
  if (!BEACON_FEATURES.includes(feature as ActivityFeature)) return null;
  if (!BEACON_TYPES.includes(type)) return null;
  return { feature: feature as ActivityFeature, type };
}

const FEATURE_LABEL: Record<string, string> = {
  single: "Single receipt",
  multiple: "Multiple receipts",
  travel: "Travel Spend",
  account: "Account",
};

/** Human label for a feature ("Travel Spend", …). */
export function featureLabel(feature: string): string {
  return FEATURE_LABEL[feature] ?? feature;
}

/**
 * One-line summary of an activity entry for the admin feed. Pure (no JSX) so it
 * can be unit-tested and reused anywhere.
 */
export function describeActivity(entry: ActivityEntry): string {
  switch (entry.type) {
    case "login":
      return "signed in";
    case "split.created":
      return `created a split in ${featureLabel(entry.feature)}`;
    case "share.created":
      return `shared a ${featureLabel(entry.feature)} summary`;
    case "receipt.added":
      return `added a receipt in ${featureLabel(entry.feature)}`;
    default:
      return `${entry.type} · ${featureLabel(entry.feature)}`;
  }
}
