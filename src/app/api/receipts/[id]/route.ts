import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAuthUser,
  unauthorized,
  forbidden,
  notFound,
  assertSameOrigin,
} from "@/lib/api-auth";
import { validationErrorResponse, ValidationError } from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  validateSharedSummaryInput,
  shareExpiryFromNow,
  SHARE_PAYLOAD_VERSION,
} from "@/lib/receipt/shared-summary";
import {
  validateSavedSplit,
  savedSplitExpiryFromNow,
  savedSplitTtlDays,
} from "@/lib/receipt/saved-splits";
import { isProActive } from "@/lib/billing/entitlements";

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

  // Prefer the JSON payload when present: it is the only representation that
  // carries per-person assignments, fees and discounts. The relational columns
  // above cannot (item_assignments is keyed on users.id, and a split is between
  // named people who mostly have no account), so a payload-backed receipt read
  // from them shows every participant owing 0 against a non-zero total.
  //
  // Server-owned metadata still comes from the row, never from client JSON.
  const payload = receipt.payloadJson as Record<string, unknown> | null;
  const meta = {
    id: receipt.id,
    version: receipt.version,
    createdById: receipt.createdById,
    tripId: receipt.tripId,
    tripName: receipt.trip?.name ?? null,
    // Drives the "expires in N days" label and lets the editor echo the code
    // back on save so the shared link is updated rather than duplicated.
    expiresAt: receipt.expiresAt?.toISOString() ?? null,
    shareCode: receipt.shareCode ?? null,
  };

  const response = payload
    ? { ...payload, ...meta, participants }
    : { ...formattedReceipt, ...meta };

  return NextResponse.json({ receipt: response });
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

  let input;
  let expectedVersion: number | undefined;
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (body && typeof body.expectedVersion === "number") {
      expectedVersion = body.expectedVersion;
    }
    input = validateSavedSplit(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  // Saving is what resets the clock — opening the split does not, because the
  // server never learns about an edit that is still only in the browser.
  const data = {
    version: { increment: 1 },
    title: input.title,
    participantsJson: input.participants as unknown as Prisma.InputJsonValue,
    payloadJson: input as unknown as Prisma.InputJsonValue,
    expiresAt: savedSplitExpiryFromNow(isProActive(user)),
  };

  // Optimistic concurrency: when the caller declares the version they observed,
  // refuse the write if it has moved on. The atomic UPDATE...WHERE id=$1 AND
  // version=$2 closes the read-then-write race window.
  if (expectedVersion !== undefined) {
    const result = await prisma.receipt.updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data,
    });
    if (result.count === 0) {
      return apiError(
        "VERSION_CONFLICT",
        "This split was saved from somewhere else. Reload it to see the latest version, then save again.",
        { currentVersion: existing.version }
      );
    }
  } else {
    // Legacy callers that don't send expectedVersion still get last-write-wins.
    await prisma.receipt.update({ where: { id }, data });
  }

  const after = await prisma.receipt.findUnique({
    where: { id },
    select: { version: true, expiresAt: true, shareCode: true },
  });

  // Tahap 2: a link already shared for this split follows the split. Before
  // this, editing left the link showing numbers everyone had moved on from,
  // and the group argued over a stale page. The share page shows when the
  // content last changed so a silent revision is still a visible one.
  //
  // Best-effort: the split itself is already saved, so a failure here must not
  // turn a successful save into an error.
  if (after?.shareCode) {
    try {
      const sharePayload = validateSharedSummaryInput({
        v: SHARE_PAYLOAD_VERSION,
        type: input.type,
        title: input.title,
        participants: input.participants,
        receipts: input.receipts,
      });
      await prisma.sharedSummary.updateMany({
        where: { code: after.shareCode },
        data: {
          payload: sharePayload as unknown as Prisma.InputJsonValue,
          // Keep the link alive as long as the split is being worked on.
          expiresAt: shareExpiryFromNow(),
        },
      });
    } catch (err) {
      console.error("Failed to refresh shared link for receipt", id, err);
    }
  }

  return NextResponse.json({
    id,
    version: after?.version ?? existing.version + 1,
    expiresAt: after?.expiresAt?.toISOString() ?? null,
    shareCode: after?.shareCode ?? null,
    ttlDays: savedSplitTtlDays(isProActive(user)),
  });
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
