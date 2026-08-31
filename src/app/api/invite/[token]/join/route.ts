import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { broadcastTripChange } from "@/lib/realtime";

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
  const existing = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId: invite.tripId, userId: user.id } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.tripMember.upsert({
      where: { tripId_userId: { tripId: invite.tripId, userId: user.id } },
      update: {},
      create: { tripId: invite.tripId, userId: user.id, role: invite.role },
    });
    // Every other trip mutation rings the trip's doorbell; joining did not, so
    // the owner watching the Members card had no way to learn that the person
    // they had just sent the link to was now in the trip. Without this the
    // owner only ever finds out by reloading — which is exactly the bug
    // reported: "my friend joined and nothing showed up on my side".
    await broadcastTripChange(invite.tripId, { kind: "member", actorId: user.id });
  }

  return NextResponse.json({ tripId: invite.tripId, alreadyMember: !!existing });
}
