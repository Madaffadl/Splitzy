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
  // Public site origin, used for canonical/legal copy.
  siteUrl: "https://www.splitzy.my.id",
} as const;

/** Current year, evaluated at render time so the copyright never goes stale. */
export function copyrightYear(): number {
  return new Date().getFullYear();
}
