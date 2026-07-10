import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

// POST /api/invite/[token]/join — join a trip via an invite token.
// Idempotent: joining twice is a no-op.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { token } = await params;

  const invite = await prisma.tripInvite.findUnique({
    where: { token },
    select: {
      tripId: true,
      expiresAt: true,
      role: true,
      trip: { select: { ownerId: true, deletedAt: true } },
    },
  });

  if (!invite || invite.expiresAt < new Date() || invite.trip.deletedAt) {
    return apiError("NOT_FOUND", "This invite link is invalid or has expired.");
  }

  // Owner is already a member — nothing to do.
  if (invite.trip.ownerId === user.id) {
    return NextResponse.json({ tripId: invite.tripId, alreadyMember: true });
  }

  // Upsert: joining more than once is a no-op.
  await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId: invite.tripId, userId: user.id } },
    update: {},
    create: { tripId: invite.tripId, userId: user.id, role: invite.role },
  });

  return NextResponse.json({ tripId: invite.tripId, alreadyMember: false });
}
