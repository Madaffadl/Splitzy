import { prisma } from "@/lib/prisma";
import { extendProExpiry } from "@/lib/billing/entitlements";

export const REFERRAL_REWARD_DAYS = 14;

// Unambiguous alphanumeric chars (no I/O/1/0 confusion).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  return Array.from({ length: 8 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

// Process a referral when a new user signs up with a ref code.
// Idempotent: unique constraint on referee_id silently ignores double-claims.
export async function processReferral(
  refereeId: string,
  code: string
): Promise<void> {
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, proExpiresAt: true, plan: true },
  });
  if (!referrer || referrer.id === refereeId) return;

  const now = new Date();
  try {
    await prisma.referral.create({
      data: { referrerId: referrer.id, refereeId, rewardedAt: now, rewardDays: REFERRAL_REWARD_DAYS },
    });
    const newExpiry = extendProExpiry(referrer.proExpiresAt, REFERRAL_REWARD_DAYS, now);
    await prisma.user.update({
      where: { id: referrer.id },
      data: { plan: "pro", proExpiresAt: newExpiry },
    });
  } catch {
    // Unique constraint on referee_id → already processed, safe to ignore.
  }
}
