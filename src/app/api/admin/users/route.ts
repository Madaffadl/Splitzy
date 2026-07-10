import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, forbidden } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";

// GET /api/admin/users — list all users with scan quota + trip stats.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  // Admin check uses email directly (bannedAt guard is already in getAuthUser,
  // but admin themselves should never be banned — bail if no user at all).
  if (!user || !isAdminEmail(user.email)) return forbidden();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      plan: true,
      aiScanCount: true,
      aiScanResetAt: true,
      aiScanLimit: true,
      bannedAt: true,
      createdAt: true,
      _count: { select: { ownedTrips: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      plan: u.plan,
      aiScanCount: u.aiScanCount,
      aiScanResetAt: u.aiScanResetAt?.toISOString() ?? null,
      aiScanLimit: u.aiScanLimit,
      bannedAt: u.bannedAt?.toISOString() ?? null,
      tripCount: u._count.ownedTrips,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
