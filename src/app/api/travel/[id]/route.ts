import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, forbidden, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { ValidationError, validationErrorResponse, validateParticipantsJson } from "@/lib/validation";
import { validateBudget } from "@/lib/travel-cloud";
import { getTripAccess } from "@/lib/trip-access";

export const runtime = "nodejs";

// GET /api/travel/[id] — full trip: name, budget, participants, receipts.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();

  const trip = await prisma.trip.findUnique({
    where: { id },
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
    },
  });
  if (!trip) return notFound();

  return NextResponse.json({
    id: trip.id,
    name: trip.name,
    budget: trip.budget ?? undefined,
    version: trip.version,
    participants: trip.participantsJson ?? [],
    receipts: trip.tripReceipts.map((r) => r.payload),
  });
}

// PUT /api/travel/[id] — update name / budget / participants (optimistic lock).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return apiError("BAD_REQUEST", "Invalid request body");

  const data: Prisma.TripUpdateInput = {};
  try {
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim().slice(0, 200);
    }
    if ("budget" in body) {
      data.budget = validateBudget(body.budget) ?? null;
    }
    if ("participants" in body) {
      const participants = validateParticipantsJson(body.participants, "participants") ?? [];
      data.participantsJson = participants as unknown as Prisma.InputJsonValue;
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body: errBody, status } = validationErrorResponse(err);
      return NextResponse.json(errBody, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : access.version;

  // Optimistic concurrency: only update if the version still matches.
  const result = await prisma.trip.updateMany({
    where: { id, version: expectedVersion, deletedAt: null },
    data: { ...data, version: { increment: 1 } },
  });
  if (result.count === 0) {
    return apiError("VERSION_CONFLICT", "This trip was changed elsewhere. Reload and try again.");
  }

  return NextResponse.json({ ok: true, version: expectedVersion + 1 });
}

// DELETE /api/travel/[id] — soft delete (owner only).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();
  if (access.ownerId !== user.id) return forbidden();

  await prisma.trip.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
