import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

// GET /api/invite/[token] — public: returns trip info for the invite landing page.
// No auth required — the token IS the secret.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.tripInvite.findUnique({
    where: { token },
    select: {
      tripId: true,
      expiresAt: true,
      createdById: true,
      trip: { select: { name: true, deletedAt: true } },
    },
  });

  if (!invite || invite.expiresAt < new Date() || invite.trip.deletedAt) {
    return apiError("NOT_FOUND", "This invite link is invalid or has expired.");
  }

  // Fetch creator name separately (no Prisma relation on TripInvite.createdBy).
  let invitedBy = "Someone";
  if (invite.createdById) {
    const creator = await prisma.user.findUnique({
      where: { id: invite.createdById },
      select: { name: true, email: true },
    });
    invitedBy = creator?.name ?? creator?.email ?? invitedBy;
  }

  return NextResponse.json({
    tripId: invite.tripId,
    tripName: invite.trip.name,
    invitedBy,
    expiresAt: invite.expiresAt.toISOString(),
  });
}
