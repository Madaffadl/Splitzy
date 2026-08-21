// Central place for product identity + contact info. Previously the footer
// hardcoded a personal Gmail / Instagram / WhatsApp; those are removed in
// favour of product-owned channels so the app reads as a product, not a
// personal side-project (audit T-03).
//
// The support email is env-driven so it can be pointed at a real mailbox per
// environment without a code change. NEXT_PUBLIC_* must be referenced as a
// static literal (the bundler inlines it at build time) — do not switch to a
// dynamic process.env[key] lookup or it resolves to undefined in the browser.
export const BRAND = {
  name: "Splitzy",
  tagline: "Split bills fairly with friends.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@splitzy.my.id",
  // Public site origin, used for canonical/legal copy. This is the CANONICAL
  // host — the apex (splitzy.my.id) 301s here via src/proxy.ts so the two never
  // compete for the same rankings.
  siteUrl: "https://www.splitzy.my.id",
} as const;

/**
 * Verified profiles Splitzy owns elsewhere on the web, emitted as `sameAs` in
 * the Organization JSON-LD.
 *
 * "Splitzy" is a contested brand name — several unrelated apps use it on the
 * App Store, Play Store, Facebook and LinkedIn. `sameAs` is how we assert that
 * *this* Splitzy is the entity that owns these particular profiles, which is
 * what lets Google tell us apart from the others.
 *
 * Calibration: this is the strongest entity signal we control *in code*, but it
 * is necessary-not-sufficient. A Knowledge Panel comes from Google corroborating
 * the entity across independent sources; `sameAs` only makes our own claim
 * machine-readable so that corroboration can land on the right entity.
 *
 * Only add URLs we actually control AND that link back to splitzy.my.id.
 * Reciprocity is the point — a profile that doesn't link back is unverifiable,
 * and a wrong or squatted profile actively confuses entity resolution, making
 * this worse than leaving the array empty. Good candidates, roughly by value:
 * a LinkedIn company page, an Instagram account, a GitHub org, an X account,
 * a Product Hunt listing.
 */
export const BRAND_PROFILES: readonly string[] = [];

/** Current year, evaluated at render time so the copyright never goes stale. */
export function copyrightYear(): number {
  return new Date().getFullYear();
}
