// Central feature-flag registry for the product transformation.
//
// WHY: every transformation feature ships to production "dark" (disabled)
// behind a flag, so existing users never see work-in-progress. We flip a
// flag on to expose it — first to ourselves, then progressively. If anything
// breaks, flip it off. No redeploy-to-revert, no long-lived branch.
//
// RULE: every flag defaults to OFF. A missing/empty env var == disabled.
//
// TWO KINDS OF FLAGS:
//   * PUBLIC  (NEXT_PUBLIC_FLAG_*) — inlined at build time, readable in both
//     client and server code. Use for UI gating (show a page/button or not).
//     Note: public flags are visible to the browser; never gate a secret with
//     one, only gate UI. Secrets always stay server-side regardless of flags.
//   * SERVER  (FLAG_*) — readable only in server code (route handlers, server
//     components, lib called from the server). Use for API routes / webhooks.
//
// SOURCE: env vars for now. Flipping requires a Vercel redeploy (~1 min).
// When we need instant flips or percentage rollouts, swap the reader body for
// PostHog/Vercel Flags — call sites (`isEnabled` / `isServerEnabled`) stay the
// same, so nothing downstream changes.

/** UI-facing flags. Exposed to the browser via NEXT_PUBLIC_FLAG_* env vars. */
export type PublicFlagKey =
  | "newLanding" // RSC landing + AI-first hero (T-08, T-14)
  | "dashboard" // post-login dashboard (T-09)
  | "onboarding" // first-run onboarding wizard (T-10)
  | "pricingPage" // pricing page + upgrade prompts (T-06, T-07)
  | "designSystemV2" // new token-based components (T-11, T-12)
  | "realtime"; // live trip collaboration via broadcast (Sprint 6)

/** Server-only flags. Never exposed to the browser. */
export type ServerFlagKey =
  | "xenditCheckout" // Xendit invoice/checkout/webhook routes (T-05)
  | "distributedRateLimit"; // Upstash-backed limiter, else in-memory (T-01)

const PUBLIC_FLAG_ENV: Record<PublicFlagKey, string> = {
  newLanding: "NEXT_PUBLIC_FLAG_NEW_LANDING",
  dashboard: "NEXT_PUBLIC_FLAG_DASHBOARD",
  onboarding: "NEXT_PUBLIC_FLAG_ONBOARDING",
  pricingPage: "NEXT_PUBLIC_FLAG_PRICING_PAGE",
  designSystemV2: "NEXT_PUBLIC_FLAG_DESIGN_SYSTEM_V2",
  realtime: "NEXT_PUBLIC_FLAG_REALTIME",
};

const SERVER_FLAG_ENV: Record<ServerFlagKey, string> = {
  xenditCheckout: "FLAG_XENDIT_CHECKOUT",
  distributedRateLimit: "FLAG_DISTRIBUTED_RATE_LIMIT",
};

// NEXT_PUBLIC_* vars are inlined by the bundler only when referenced as a
// static `process.env.NEXT_PUBLIC_FOO` literal. A dynamic `process.env[name]`
// lookup is NOT inlined and reads `undefined` in the browser. So public flags
// must be resolved through this static map, not a dynamic key.
const PUBLIC_FLAG_VALUE: Record<PublicFlagKey, string | undefined> = {
  newLanding: process.env.NEXT_PUBLIC_FLAG_NEW_LANDING,
  dashboard: process.env.NEXT_PUBLIC_FLAG_DASHBOARD,
  onboarding: process.env.NEXT_PUBLIC_FLAG_ONBOARDING,
  pricingPage: process.env.NEXT_PUBLIC_FLAG_PRICING_PAGE,
  designSystemV2: process.env.NEXT_PUBLIC_FLAG_DESIGN_SYSTEM_V2,
  realtime: process.env.NEXT_PUBLIC_FLAG_REALTIME,
};

function truthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

/** Is a UI flag on? Safe to call from client or server components. */
export function isEnabled(key: PublicFlagKey): boolean {
  return truthy(PUBLIC_FLAG_VALUE[key]);
}

/** Is a server-only flag on? Server code only — reads a non-public env var. */
export function isServerEnabled(key: ServerFlagKey): boolean {
  return truthy(process.env[SERVER_FLAG_ENV[key]]);
}

/** Env-var name for a flag — handy for docs, error messages, and tests. */
export function flagEnvName(key: PublicFlagKey | ServerFlagKey): string {
  return (
    (PUBLIC_FLAG_ENV as Record<string, string>)[key] ??
    (SERVER_FLAG_ENV as Record<string, string>)[key]
  );
}
