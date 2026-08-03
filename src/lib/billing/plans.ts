// Single source of truth for Splitzy's plans and pricing (Sprint 2 monetization).
// Change the price here and it updates the pricing page, checkout amount, and
// entitlement period everywhere. Pro is sold as a one-time monthly purchase
// (pay once → PRO_PLAN.periodDays of Pro), renewed manually.

export const PRO_PLAN = {
  id: "pro" as const,
  name: "Pro",
  // Whole rupiah — IDR has no minor units. This is the amount charged by Xendit.
  priceIDR: 29_000,
  currency: "IDR" as const,
  // How long one payment grants Pro for.
  periodDays: 30,
};

export const FREE_PLAN = {
  id: "free" as const,
  name: "Free",
  priceIDR: 0,
  currency: "IDR" as const,
};

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
  "Travel Spend trips",
  "15 AI receipt scans per month",
  "Receipt history synced across devices",
];

export const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited AI receipt scans",
  "Priority AI processing",
  "Support the project 💚",
];
