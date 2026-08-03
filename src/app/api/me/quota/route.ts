import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { checkScanQuota } from "@/lib/scan-quota";

// Read-only view of the caller's AI scan quota, for the dashboard widget and
// paywall. remaining === null means unlimited (Pro).
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const q = await checkScanQuota(user.id);
  return NextResponse.json({
    plan: q.plan,
    isPro: q.plan === "pro",
    remaining: q.remaining === Infinity ? null : q.remaining,
    resetAt: q.resetAt,
  });
}
