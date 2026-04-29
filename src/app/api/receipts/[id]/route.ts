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
  validateReceiptPatch,
  validationErrorResponse,
  ValidationError,
} from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

// GET /api/receipts/[id] - Get receipt detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  // Auth-first: fetch only the columns needed for the access decision before
  // pulling full nested data. Wasted DB work and JSON serialization for
  // unauthorized requests is now ~0.
  const auth = await prisma.receipt.findUnique({
    where: { id },
    select: {
      id: true,
      tripId: true,
      createdById: true,
      payerId: true,
      deletedAt: true,
      items: {
        select: {
          assignments: { select: { userId: true } },
        },
      },
    },
  });

  // Soft-deleted rows are treated as 404 — they no longer exist for the user.
  if (!auth || auth.deletedAt) {
    return notFound();
  }

  const isInvolved =
    auth.createdById === user.id ||
    auth.payerId === user.id ||
    auth.items.some((item) =>
      item.assignments.some((a) => a.userId === user.id)
    );

  if (!isInvolved) {
    if (!auth.tripId) {
      return forbidden();
    }
    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId: auth.tripId, userId: user.id } },
      select: { id: true },
    });
    if (!membership) {
      return forbidden();
    }
  }

  // Authorized — now fetch full payload.
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      trip: { select: { name: true } },
      payer: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          assignments: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!receipt) {
    // Race: deleted between auth and fetch.
    return notFound();
  }

  // Build participants list from assignments + payer
  const participantMap = new Map<string, { id: string; name: string }>();
  participantMap.set(receipt.payer.id, {
    id: receipt.payer.id,
    name: receipt.payer.name || receipt.payer.email,
  });
  receipt.items.forEach((item) => {
    item.assignments.forEach((a) => {
      if (!participantMap.has(a.user.id)) {
        participantMap.set(a.user.id, {
          id: a.user.id,
          name: a.user.name || a.user.email,
        });
      }
    });
  });

  // If the receipt has participantsJson (imported from localStorage), use that
  const participants = receipt.participantsJson
    ? (receipt.participantsJson as Array<{ id: string; name: string }>)
    : Array.from(participantMap.values());

  const formattedReceipt = {
    id: receipt.id,
    title: receipt.title,
    date: receipt.date?.toISOString() ?? null,
    tax: receipt.tax,
    service: receipt.service,
    payerId: receipt.payerId,
    createdById: receipt.createdById,
    tripId: receipt.tripId,
    tripName: receipt.trip?.name ?? null,
    // Surface the current version so clients can echo it back in PUT requests
    // (optimistic concurrency).
    version: receipt.version,
    participants,
    items: receipt.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      total: item.total,
      assignedToIds: item.assignments.map((a) => a.userId),
    })),
  };

  return NextResponse.json({ receipt: formattedReceipt });
}

// PUT /api/receipts/[id] - Update receipt
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "receipts:update", { userId: user.id });
  if (limited) return limited;

  const { id } = await params;

  const existing = await prisma.receipt.findUnique({
    where: { id },
    select: { createdById: true, deletedAt: true, version: true },
  });

  if (!existing || existing.deletedAt) {
    return notFound();
  }

  if (existing.createdById !== user.id) {
    return forbidden();
  }

  let patch;
  try {
    const body = await request.json().catch(() => null);
    patch = validateReceiptPatch(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  // Optimistic concurrency: when the caller declares the version they observed,
  // refuse the write if it has moved on. The atomic UPDATE...WHERE id=$1 AND
  // version=$2 closes the read-then-write race window.
  if (patch.expectedVersion !== undefined) {
    const result = await prisma.receipt.updateMany({
      where: { id, version: patch.expectedVersion, deletedAt: null },
      data: {
        version: { increment: 1 },
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.payerId !== undefined && { payerId: patch.payerId }),
        ...(patch.tax !== undefined && { tax: patch.tax }),
        ...(patch.service !== undefined && { service: patch.service }),
        ...(patch.date !== undefined && {
          date: patch.date ? new Date(patch.date) : null,
        }),
      },
    });
    if (result.count === 0) {
      return apiError(
        "VERSION_CONFLICT",
        "This receipt was modified by someone else. Reload to see the latest version, then try again.",
        { currentVersion: existing.version }
      );
    }
    return NextResponse.json({ id, version: existing.version + 1 });
  }

  // Legacy clients that don't send expectedVersion still get last-write-wins.
  const updated = await prisma.receipt.update({
    where: { id },
    data: {
      version: { increment: 1 },
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.payerId !== undefined && { payerId: patch.payerId }),
      ...(patch.tax !== undefined && { tax: patch.tax }),
      ...(patch.service !== undefined && { service: patch.service }),
      ...(patch.date !== undefined && {
        date: patch.date ? new Date(patch.date) : null,
      }),
    },
    select: { id: true, version: true },
  });

  return NextResponse.json({ id: updated.id, version: updated.version });
}

// DELETE /api/receipts/[id] - Soft-delete a receipt (creator only).
//
// Soft delete: row stays with deletedAt = now() so we can audit and restore.
// All list/detail queries filter on `deletedAt: null` so the row disappears
// from the user's view. A scheduled cleanup job can hard-delete rows older
// than N days if needed.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "receipts:delete", {
    userId: user.id,
    limit: 30,
  });
  if (limited) return limited;

  const { id } = await params;

  const existing = await prisma.receipt.findUnique({
    where: { id },
    select: { createdById: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    return notFound();
  }

  if (existing.createdById !== user.id) {
    return forbidden();
  }

  await prisma.receipt.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
