import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { ValidationError, validationErrorResponse, isUuid } from "@/lib/validation";
import { validateTripPaymentInput } from "@/lib/travel/travel-cloud";
import { getTripAccess, requireOwnerWrite } from "@/lib/travel/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { broadcastTripChange } from "@/lib/realtime";

export const runtime = "nodejs";

// POST /api/travel/[id]/payments — record a settle-up payment between two
// participants. Adjusts the final settlement (does not touch receipts).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:payment", { userId: user.id, limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();
  const gate = requireOwnerWrite(access);
  if (gate) return gate;

  const trip = await prisma.trip.findUnique({ where: { id }, select: { participantsJson: true } });
  const participants = (trip?.participantsJson as unknown as { id: string }[] | null) ?? [];
  const participantIds = new Set(participants.map((p) => p.id));

  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  let input;
  try {
    input = validateTripPaymentInput(rawBody, participantIds);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  // The client may mint the row id (a real UUID) so its optimistic row and the
  // stored row are the same thing — no temp id to swap, and no window where a
  // delete addresses an id the server has never heard of. Anything that isn't a
  // UUID is rejected rather than silently ignored, so a client that regresses to
  // a placeholder id fails loudly here instead of at the driver.
  if (rawBody?.id != null && !isUuid(rawBody.id)) {
    return apiError("BAD_REQUEST", "payment id must be a UUID");
  }
  const clientId = isUuid(rawBody?.id) ? rawBody.id : undefined;

  const SELECT = {
    id: true, fromParticipantId: true, toParticipantId: true, amount: true,
    currency: true, fxRate: true, note: true, source: true, createdAt: true,
  } as const;

  let payment;
  try {
    payment = await prisma.tripPayment.create({
      data: {
        ...(clientId ? { id: clientId } : {}),
        tripId: id,
        fromParticipantId: input.from,
        toParticipantId: input.to,
        amount: input.amount,
        currency: input.currency ?? null,
        fxRate: input.fxRate ?? null,
        note: input.note ?? null,
        source: input.source ?? null,
        createdById: user.id,
      },
      select: SELECT,
    });
  } catch (err) {
    // A retried POST (offline replay, double tap) hits the primary key. Return
    // the row that already exists instead of a 500 — but only if it belongs to
    // THIS trip, so a guessed id can never be used to read another trip's row.
    const isDuplicate =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (!isDuplicate || !clientId) throw err;
    const existing = await prisma.tripPayment.findFirst({
      where: { id: clientId, tripId: id },
      select: SELECT,
    });
    if (!existing) return apiError("BAD_REQUEST", "payment id already in use");
    payment = existing;
  }

  await broadcastTripChange(id, { kind: "payment", actorId: user.id });
  return NextResponse.json(
    {
      id: payment.id,
      from: payment.fromParticipantId,
      to: payment.toParticipantId,
      amount: payment.amount,
      ...(payment.currency ? { currency: payment.currency } : {}),
      ...(payment.fxRate ? { fxRate: payment.fxRate } : {}),
      note: payment.note ?? undefined,
      source: payment.source ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
