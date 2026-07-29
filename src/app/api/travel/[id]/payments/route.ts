import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { validateTripPaymentInput } from "@/lib/travel-cloud";
import { getTripAccess, requireOwnerWrite } from "@/lib/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";

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

  let input;
  try {
    input = validateTripPaymentInput(await request.json().catch(() => null), participantIds);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  const payment = await prisma.tripPayment.create({
    data: {
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
    select: { id: true, fromParticipantId: true, toParticipantId: true, amount: true, currency: true, fxRate: true, note: true, source: true, createdAt: true },
  });

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
