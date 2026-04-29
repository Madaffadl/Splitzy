import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthUser,
  unauthorized,
  forbidden,
  notFound,
  assertSameOrigin,
} from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

// POST /api/trips/[id]/restore - Un-soft-delete a trip + cascade-restore its
// receipts that were soft-deleted as part of the same trip-delete operation.
//
// Cascade rule: only restore receipts whose deletedAt matches the trip's
// deletedAt within a 5-second window. Receipts that were soft-deleted
// independently (before the trip was deleted) stay deleted — they were
// already gone before the cascade and the user explicitly chose that.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "trips:restore", {
    userId: user.id,
    limit: 20,
  });
  if (limited) return limited;

  const { id } = await params;

  const existing = await prisma.trip.findUnique({
    where: { id },
    select: { ownerId: true, deletedAt: true },
  });

  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden();
  if (!existing.deletedAt) {
    return NextResponse.json({ id, restored: false });
  }

  const tripDeletedAt = existing.deletedAt;
  const cascadeWindow = 5_000; // ms — receipts deleted within this window of
                               // the trip are considered cascaded.
  const minCascadeDelete = new Date(tripDeletedAt.getTime() - cascadeWindow);
  const maxCascadeDelete = new Date(tripDeletedAt.getTime() + cascadeWindow);

  await prisma.$transaction([
    prisma.receipt.updateMany({
      where: {
        tripId: id,
        deletedAt: { gte: minCascadeDelete, lte: maxCascadeDelete },
      },
      data: { deletedAt: null, version: { increment: 1 } },
    }),
    prisma.trip.update({
      where: { id },
      data: { deletedAt: null, version: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ id, restored: true });
}
