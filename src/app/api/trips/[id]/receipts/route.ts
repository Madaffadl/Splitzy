import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAuthUser,
  unauthorized,
  forbidden,
  assertSameOrigin,
} from "@/lib/api-auth";
import {
  validateReceiptCreate,
  validationErrorResponse,
  ValidationError,
} from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

// GET /api/trips/[id]/receipts - Paginated receipts within a trip.
//
// Lives on its own endpoint (rather than embedded in /api/trips/[id]) so the
// trip detail payload stays slim. Callers paginate as the trip grows.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id: tripId } = await params;

  // Cheap membership check before any list query.
  const membership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: user.id } },
    select: { id: true },
  });
  if (!membership) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;

  const where = { tripId, deletedAt: null };
  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      select: {
        id: true,
        title: true,
        date: true,
        payerId: true,
        tax: true,
        service: true,
        version: true,
        createdAt: true,
        payer: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            name: true,
            qty: true,
            unitPrice: true,
            total: true,
            assignments: { select: { userId: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.receipt.count({ where }),
  ]);

  return NextResponse.json({
    data: receipts.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date?.toISOString() ?? null,
      payerId: r.payerId,
      payerName: r.payer.name,
      tax: r.tax,
      service: r.service,
      createdAt: r.createdAt.toISOString(),
      items: r.items.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        total: item.total,
        assignedToIds: item.assignments.map((a) => a.userId),
      })),
    })),
    total,
    page,
    limit,
    hasMore: skip + limit < total,
  });
}

// POST /api/trips/[id]/receipts - Add a receipt to a trip
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "trip-receipts:create", {
    userId: user.id,
  });
  if (limited) return limited;

  const { id: tripId } = await params;

  const membership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: user.id } },
    select: { id: true },
  });
  if (!membership) return forbidden();

  let input;
  try {
    const body = await request.json().catch(() => null);
    input = validateReceiptCreate(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  const receipt = await prisma.receipt.create({
    data: {
      title: input.title,
      payerId: input.payerId || user.id,
      tax: input.tax,
      service: input.service,
      date: input.date ? new Date(input.date) : null,
      tripId,
      createdById: user.id,
      participantsJson:
        (input.participantsJson as Prisma.InputJsonValue | null) ??
        Prisma.JsonNull,
      items: {
        create: input.items.map((item, index) => ({
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          total: item.total,
          sortOrder: index,
          assignments: {
            create: item.assignedToUserIds.map((userId) => ({ userId })),
          },
        })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: receipt.id }, { status: 201 });
}
