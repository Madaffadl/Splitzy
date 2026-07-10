import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, forbidden } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";

// GET /api/admin/users/[id]/trips — list a user's owned trips (admin only).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user || !isAdminEmail(user.email)) return forbidden();

  const { id } = await params;

  const trips = await prisma.trip.findMany({
    where: { ownerId: id, deletedAt: null },
    select: {
      id: true,
      name: true,
      budget: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { tripReceipts: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t.id,
      name: t.name,
      budget: t.budget ?? null,
      receiptCount: t._count.tripReceipts,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}
