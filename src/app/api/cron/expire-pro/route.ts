import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Daily housekeeping (audit Sprint 3): downgrade users whose one-time Pro
// period has lapsed. Read-time entitlement checks (isProActive) already treat
// expired Pro as free, so this is a data-tidiness/accuracy job, not a
// correctness one — it keeps "active Pro" counts and admin views honest.
//
// Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <secret>`
// when the env var is set. Refuses to run if the secret is unset so it can't be
// triggered anonymously. Scheduled in vercel.json.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // proExpiresAt: { lt: now } excludes NULL, so comped/admin Pro (null expiry)
  // is never touched.
  const result = await prisma.user.updateMany({
    where: { plan: "pro", proExpiresAt: { lt: now } },
    data: { plan: "free" },
  });

  return NextResponse.json({ downgraded: result.count, ranAt: now.toISOString() });
}
