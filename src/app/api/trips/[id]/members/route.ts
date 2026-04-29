import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthUser,
  unauthorized,
  forbidden,
  notFound,
  assertSameOrigin,
} from "@/lib/api-auth";
import {
  validateMemberAdd,
  validationErrorResponse,
  ValidationError,
} from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/trips/[id]/members - Add a member to a trip.
// Returns the same generic success response whether or not the email exists,
// to avoid leaking which emails are registered with the service (P3).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  // Tighter cap: invitations are mostly humans clicking, no legitimate bursts.
  const limited = enforceRateLimit(request, "members:add", {
    userId: user.id,
    limit: 20,
  });
  if (limited) return limited;

  const { id: tripId } = await params;

  // Only owner can add members
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { ownerId: true },
  });

  if (!trip) return notFound();
  if (trip.ownerId !== user.id) return forbidden();

  let input;
  try {
    const body = await request.json().catch(() => null);
    input = validateMemberAdd(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  // Generic response — does not reveal whether the email is registered or
  // already a member of this trip.
  const genericOk = NextResponse.json(
    {
      ok: true,
      message: "If that email belongs to a Splitzy user, they have been invited.",
    },
    { status: 200 }
  );

  const targetUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true },
  });

  // Email not registered → still return generic success.
  if (!targetUser) return genericOk;

  // Already a member → still return generic success (idempotent for owner).
  const existing = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: targetUser.id } },
  });
  if (existing) return genericOk;

  await prisma.tripMember.create({
    data: {
      tripId,
      userId: targetUser.id,
      role: "member",
    },
  });

  return genericOk;
}

// DELETE /api/trips/[id]/members - Remove a member from a trip
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "members:remove", {
    userId: user.id,
    limit: 30,
  });
  if (limited) return limited;

  const { id: tripId } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { ownerId: true },
  });

  if (!trip) return notFound();
  if (trip.ownerId !== user.id) return forbidden();

  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.userId === "string" ? body.userId : null;

  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return apiError("VALIDATION_FAILED", "userId is required and must be a valid UUID", {
      field: "userId",
    });
  }

  if (targetUserId === trip.ownerId) {
    return apiError("VALIDATION_FAILED", "Cannot remove the trip owner", {
      field: "userId",
    });
  }

  // Existence check so the caller learns when a delete had no effect (e.g. a
  // stale UI). Without this, deleteMany silently returns success on no-op.
  const existing = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: targetUserId } },
    select: { id: true },
  });
  if (!existing) return notFound("Member not found in this trip");

  await prisma.tripMember.deleteMany({
    where: { tripId, userId: targetUserId },
  });

  return NextResponse.json({ success: true });
}
