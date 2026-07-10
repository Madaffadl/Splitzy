import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { validateTravelTripInput } from "@/lib/travel-cloud";

export const runtime = "nodejs";

// GET /api/travel — the signed-in user's trips (owned or member), fully
// hydrated. Returning participants + receipts + members here (instead of a
// summary that the client then N+1-fetches per trip) collapses the initial
// load into a single round trip. Fine for this app's scale (few trips).
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
      version: true,
      participantsJson: true,
      tripReceipts: {
        select: { payload: true },
        orderBy: { sortOrder: "asc" },
      },
      members: {
        select: {
          userId: true,
          role: true,
          joinedAt: true,
          user: { select: { name: true, email: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t.id,
      name: t.name,
      budget: t.budget ?? undefined,
      version: t.version,
      participants: t.participantsJson ?? [],
      receipts: t.tripReceipts.map((r) => r.payload),
      members: t.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role as "owner" | "member",
        joinedAt: m.joinedAt.toISOString(),
      })),
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
    select: { id: true, version: true },
  });

  return NextResponse.json({ id: trip.id, version: trip.version }, { status: 201 });
}
