// Single source of truth for Splitzy's plans and pricing.
// PRO_PLAN holds the shared plan id used by entitlements and the DB.
// PRO_PLANS holds the three purchasable durations shown on the pricing page.

export const PRO_PLAN = {
  id: "pro" as const,
  name: "Pro",
  currency: "IDR" as const,
  // Default periodDays used as fallback in extendProExpiry.
  periodDays: 30,
  // Default price kept for backward compat — prefer PRO_PLANS entries.
  priceIDR: 29_000,
};

export const FREE_PLAN = {
  id: "free" as const,
  name: "Free",
  priceIDR: 0,
  currency: "IDR" as const,
};

/** The three purchasable Pro durations. */
export const PRO_PLANS = [
  {
    id: "pro_trip" as const,
    label: "Trip Pass",
    periodDays: 10,
    priceIDR: 14_900,
    perDayIDR: 1_490,
    badge: null as string | null,
  },
  {
    id: "pro_monthly" as const,
    label: "30 Hari",
    periodDays: 30,
    priceIDR: 29_000,
    perDayIDR: 967,
    badge: "Most Popular" as string | null,
  },
  {
    id: "pro_annual" as const,
    label: "1 Tahun",
    periodDays: 365,
    priceIDR: 99_000,
    perDayIDR: 271,
    badge: "Best Value" as string | null,
  },
];

export type ProPlanVariantId = typeof PRO_PLANS[number]["id"];

/** Look up a Pro plan variant by its id. Returns undefined if not found. */
export function getProPlanVariant(id: string) {
  return PRO_PLANS.find((p) => p.id === id);
}

/** Format a whole-rupiah amount as "Rp 29.000" (Indonesian convention). */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Marketing feature lists for the pricing page. */
export const FREE_FEATURES = [
  "Split single & multiple receipts",
  "1 active Travel Spend trip",
  "5 AI receipt scans per month",
  "Receipt history for 45 days",
];

export const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited active Travel Spend trips",
  "Unlimited AI receipt scans",
  "Priority AI processing",
  "Trip collaboration (invite, review, realtime)",
  "Receipt history for 1 year",
];
