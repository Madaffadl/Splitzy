import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { validateTravelTripInput } from "@/lib/travel-cloud";

export const runtime = "nodejs";

// GET /api/travel — list the signed-in user's trips (owned or member).
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const trips = await prisma.trip.findMany({
    where: {
      deletedAt: null,
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    select: {
      id: true,
      name: true,
      budget: true,
      updatedAt: true,
      _count: { select: { tripReceipts: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t.id,
      name: t.name,
      budget: t.budget ?? undefined,
      receiptCount: t._count.tripReceipts,
      memberCount: t._count.members,
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

// POST /api/travel — create a trip (also used for guest→cloud sync: send the
// whole local trip incl. participants + receipts).
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "travel:create", { userId: user.id });
  if (limited) return limited;

  let input;
  try {
    input = validateTravelTripInput(await request.json().catch(() => null));
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  const trip = await prisma.trip.create({
    data: {
      name: input.name,
      ownerId: user.id,
      budget: input.budget ?? null,
      participantsJson: input.participants as unknown as Prisma.InputJsonValue,
      members: { create: { userId: user.id, role: "owner" } },
      tripReceipts: {
        create: input.receipts.map((r, i) => ({
          payload: r as unknown as Prisma.InputJsonValue,
          sortOrder: i,
          createdById: user.id,
        })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: trip.id }, { status: 201 });
}
