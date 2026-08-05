import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { validateTripReceiptPayload } from "@/lib/travel-cloud";
import { getTripAccess, requireOwnerWrite } from "@/lib/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { broadcastTripChange } from "@/lib/realtime";

export const runtime = "nodejs";

// POST /api/travel/[id]/receipts — add one receipt to the trip.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:receipt", { userId: user.id, limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();
  const gate = requireOwnerWrite(access);
  if (gate) return gate;

  const trip = await prisma.trip.findUnique({ where: { id }, select: { participantsJson: true } });
  const participants = (trip?.participantsJson as unknown as { id: string }[] | null) ?? [];
  const participantIds = new Set(participants.map((p) => p.id));

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  let payload;
  try {
    payload = validateTripReceiptPayload(body?.receipt ?? body, participantIds);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body: errBody, status } = validationErrorResponse(err);
      return NextResponse.json(errBody, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  const receiptId = (payload as { id: string }).id;
  if (!receiptId || typeof receiptId !== "string") {
    return apiError("BAD_REQUEST", "receipt.id is required");
  }

  // Use the client-generated receipt.id as the DB row ID so the client can
  // address receipts for PUT/DELETE without a separate server-assigned rid.
  // upsert makes this idempotent (safe for retry / guest→cloud sync).
  let row: { id: string };
  try {
    row = await prisma.tripReceipt.upsert({
      where: { id: receiptId },
      update: { payload: payload as unknown as Prisma.InputJsonValue },
      create: {
        id: receiptId,
        tripId: id,
        payload: payload as unknown as Prisma.InputJsonValue,
        createdById: user.id,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[travel/receipts POST] upsert failed:", err);
    return apiError("INTERNAL_ERROR", "Failed to save receipt — please try again");
  }

  await broadcastTripChange(id, { kind: "receipt", actorId: user.id });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
