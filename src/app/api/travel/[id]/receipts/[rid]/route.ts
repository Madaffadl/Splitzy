import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { validateTripReceiptPayload } from "@/lib/travel-cloud";
import { getTripAccess, requireOwnerWrite } from "@/lib/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const WRITE_RL = { limit: 120, windowMs: 60_000 };

// PUT /api/travel/[id]/receipts/[rid] — replace a receipt's payload.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:receipt", { userId: user.id, ...WRITE_RL });
  if (limited) return limited;
  const { id, rid } = await params;

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

  const result = await prisma.tripReceipt.updateMany({
    where: { id: rid, tripId: id },
    data: { payload: payload as unknown as Prisma.InputJsonValue },
  });
  if (result.count === 0) return notFound();

  return NextResponse.json({ ok: true });
}

// DELETE /api/travel/[id]/receipts/[rid] — remove a receipt.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:receipt", { userId: user.id, ...WRITE_RL });
  if (limited) return limited;
  const { id, rid } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();
  const gate = requireOwnerWrite(access);
  if (gate) return gate;

  const result = await prisma.tripReceipt.deleteMany({ where: { id: rid, tripId: id } });
  if (result.count === 0) return notFound();

  return NextResponse.json({ ok: true });
}
