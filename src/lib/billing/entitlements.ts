import type { User } from "@prisma/client";
import { PRO_PLAN } from "@/lib/billing/plans";

// Central entitlement check. Keeps the "is this user Pro right now?" rule in one
// place so scan-quota (and any future paywall) agree.
//
// Rules:
//   - plan must be "pro"
//   - proExpiresAt in the future → active
//   - proExpiresAt null → active forever (admin-comped / grandfathered Pro that
//     was never sold as a timed period)
//   - proExpiresAt in the past → EXPIRED, treated as free
export function isProActive(
  user: Pick<User, "plan" | "proExpiresAt">,
  now: Date = new Date()
): boolean {
  if (user.plan !== PRO_PLAN.id) return false;
  if (!user.proExpiresAt) return true;
  return user.proExpiresAt.getTime() > now.getTime();
}

/**
 * Compute the new Pro expiry after a successful payment. Extends from the later
 * of "now" or the user's current expiry, so buying again while still Pro stacks
 * the remaining time instead of throwing it away.
 */
export function extendProExpiry(
  currentExpiry: Date | null,
  periodDays: number = PRO_PLAN.periodDays,
  now: Date = new Date()
): Date {
  const base =
    currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return new Date(base.getTime() + periodDays * 24 * 60 * 60 * 1000);
}
