import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, forbidden, assertSameOrigin } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// POST /api/travel/[id]/restore — undo a soft-deleted trip (owner only).
// getTripAccess can't be used here because it filters out deleted rows, so we
// look the trip up directly (including deleted) and check ownership.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:trip", { userId: user.id, limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: { ownerId: true, deletedAt: true },
  });
  if (!trip) return notFound();
  if (trip.ownerId !== user.id) return forbidden("Only the trip owner can restore it");

  // Idempotent: restoring an already-active trip is a no-op.
  if (trip.deletedAt) {
    await prisma.trip.update({ where: { id }, data: { deletedAt: null } });
  }

  return NextResponse.json({ ok: true });
}
