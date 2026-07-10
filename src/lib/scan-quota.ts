import { prisma } from "@/lib/prisma";

export const FREE_SCAN_LIMIT = 15;

export interface ScanQuotaStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  plan: string;
}

/**
 * Check whether the user may perform an AI scan this month.
 * Handles monthly window reset automatically.
 */
export async function checkScanQuota(userId: string): Promise<ScanQuotaStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, aiScanCount: true, aiScanResetAt: true, aiScanLimit: true },
  });
  if (!user) return { allowed: false, remaining: 0, resetAt: null, plan: "free" };

  if (user.plan === "pro") {
    return { allowed: true, remaining: Infinity, resetAt: null, plan: "pro" };
  }

  // Per-user override takes precedence over the plan default.
  const effectiveLimit = user.aiScanLimit ?? FREE_SCAN_LIMIT;

  const now = new Date();
  let count = user.aiScanCount;

  // Monthly window expired → reset counter now.
  if (user.aiScanResetAt && user.aiScanResetAt <= now) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiScanCount: 0, aiScanResetAt: null },
    });
    count = 0;
  }

  const remaining = Math.max(0, effectiveLimit - count);
  return { allowed: remaining > 0, remaining, resetAt: user.aiScanResetAt, plan: "free" };
}

/**
 * Atomically increment the user's AI scan counter and, on the first scan of a
 * new monthly window, set the reset date to the first day of next month.
 */
export async function incrementScanCount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiScanResetAt: true },
  });

  const now = new Date();
  // Reset window: midnight on the 1st of next month (UTC).
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  await prisma.user.update({
    where: { id: userId },
    data: {
      aiScanCount: { increment: 1 },
      // Only set resetAt on the first scan of a new window.
      ...(!user?.aiScanResetAt ? { aiScanResetAt: nextReset } : {}),
    },
  });
}

/**
 * Reset a user's AI scan counter (admin action).
 */
export async function resetScanQuota(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { aiScanCount: 0, aiScanResetAt: null },
  });
}
