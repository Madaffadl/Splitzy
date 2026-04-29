import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import {
  validateTripCreate,
  validationErrorResponse,
  ValidationError,
} from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

// GET /api/trips - List trips for authenticated user
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const trips = await prisma.trip.findMany({
    where: {
      AND: [
        { deletedAt: null },
        {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
      ],
    },
    include: {
      _count: {
        // Only count non-deleted receipts.
        select: { receipts: { where: { deletedAt: null } }, members: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t.id,
      name: t.name,
      receiptCount: t._count.receipts,
      memberCount: t._count.members,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

// POST /api/trips - Create a new trip
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "trips:create", { userId: user.id });
  if (limited) return limited;

  let input: { name: string };
  try {
    const body = await request.json().catch(() => null);
    input = validateTripCreate(body);
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
      members: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: trip.id }, { status: 201 });
}
