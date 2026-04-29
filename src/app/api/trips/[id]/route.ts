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
  validateTripPatch,
  validationErrorResponse,
  ValidationError,
} from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

// GET /api/trips/[id] - Trip metadata + member list.
//
// Returns a slim payload by default. For receipts, callers must paginate via
// /api/trips/[id]/receipts instead — embedding all receipts here was producing
// 50k-row payloads on large trips.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  // Auth-first: minimal columns to decide access; full payload only after.
  const auth = await prisma.trip.findUnique({
    where: { id },
    select: {
      ownerId: true,
      deletedAt: true,
      members: { select: { userId: true } },
    },
  });

  if (!auth || auth.deletedAt) {
    return notFound();
  }

  const isMember =
    auth.ownerId === user.id || auth.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return forbidden();
  }

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      ownerId: true,
      version: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      members: {
        select: {
          role: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
      // Only count receipts that are still active.
      _count: { select: { receipts: { where: { deletedAt: null } } } },
    },
  });

  if (!trip) {
    return notFound();
  }

  return NextResponse.json({
    trip: {
      id: trip.id,
      name: trip.name,
      ownerId: trip.ownerId,
      version: trip.version,
      owner: trip.owner,
      members: trip.members.map((m) => ({
        id: m.user.id,
        name: m.user.name || m.user.email,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
      })),
      receiptCount: trip._count.receipts,
      createdAt: trip.createdAt.toISOString(),
    },
  });
}

// PUT /api/trips/[id] - Update trip
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "trips:update", { userId: user.id });
  if (limited) return limited;

  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: { ownerId: true, deletedAt: true, version: true },
  });

  if (!trip || trip.deletedAt) {
    return notFound();
  }

  if (trip.ownerId !== user.id) {
    return forbidden();
  }

  let patch;
  try {
    const body = await request.json().catch(() => null);
    patch = validateTripPatch(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  // Optimistic concurrency — see receipts PUT for the rationale.
  if (patch.expectedVersion !== undefined) {
    const result = await prisma.trip.updateMany({
      where: { id, version: patch.expectedVersion, deletedAt: null },
      data: {
        version: { increment: 1 },
        ...(patch.name !== undefined && { name: patch.name }),
      },
    });
    if (result.count === 0) {
      return apiError(
        "VERSION_CONFLICT",
        "This trip was modified by someone else. Reload to see the latest version, then try again.",
        { currentVersion: trip.version }
      );
    }
    return NextResponse.json({ id, version: trip.version + 1 });
  }

  const updated = await prisma.trip.update({
    where: { id },
    data: {
      version: { increment: 1 },
      ...(patch.name !== undefined && { name: patch.name }),
    },
    select: { id: true, version: true },
  });

  return NextResponse.json({ id: updated.id, version: updated.version });
}

// DELETE /api/trips/[id] - Soft-delete a trip and cascade-soft-delete its
// receipts (owner only).
//
// We must cascade manually because soft delete is a row update, not a row
// delete — Postgres' ON DELETE CASCADE doesn't fire. Done in one transaction
// so the trip + receipts disappear atomically.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "trips:delete", {
    userId: user.id,
    limit: 30,
  });
  if (limited) return limited;

  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: { ownerId: true, deletedAt: true },
  });

  if (!trip || trip.deletedAt) {
    return notFound();
  }

  if (trip.ownerId !== user.id) {
    return forbidden();
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.receipt.updateMany({
      where: { tripId: id, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.trip.update({
      where: { id },
      data: { deletedAt: now },
    }),
  ]);

  return NextResponse.json({ success: true });
}
