import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

// POST /api/trips/[id]/members - Add a member to a trip
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id: tripId } = await params;

  // Only owner can add members
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { ownerId: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (trip.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  // Find user by email
  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: "User not found. They need to sign up first." },
      { status: 404 }
    );
  }

  // Check if already a member
  const existing = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: targetUser.id } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "User is already a member" },
      { status: 409 }
    );
  }

  await prisma.tripMember.create({
    data: {
      tripId,
      userId: targetUser.id,
      role: "member",
    },
  });

  return NextResponse.json(
    { member: { id: targetUser.id, name: targetUser.name, email: targetUser.email } },
    { status: 201 }
  );
}

// DELETE /api/trips/[id]/members - Remove a member from a trip
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id: tripId } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { ownerId: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (trip.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId: targetUserId } = body;

  if (!targetUserId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  // Cannot remove owner
  if (targetUserId === trip.ownerId) {
    return NextResponse.json(
      { error: "Cannot remove the trip owner" },
      { status: 400 }
    );
  }

  await prisma.tripMember.deleteMany({
    where: { tripId, userId: targetUserId },
  });

  return NextResponse.json({ success: true });
}
