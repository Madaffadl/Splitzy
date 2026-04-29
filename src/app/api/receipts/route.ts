import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import {
  validateReceiptCreate,
  validationErrorResponse,
  ValidationError,
} from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

// Cursor format is `<ISO createdAt>|<id>`. Two columns are needed for stable
// ordering when multiple rows share the same createdAt (rare, but safe).
const CURSOR_SEP = "|";

function encodeCursor(createdAt: Date, id: string): string {
  // base64url to keep it URL-safe and opaque to clients.
  return Buffer.from(`${createdAt.toISOString()}${CURSOR_SEP}${id}`)
    .toString("base64url");
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.indexOf(CURSOR_SEP);
    if (sep === -1) return null;
    const createdAt = new Date(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

// GET /api/receipts - List receipts for the authenticated user.
//
// Pagination supports two modes for backward compat:
//   * `?cursor=<opaque>` (preferred) — keyset pagination, O(log n) regardless
//     of position, scales to millions of rows.
//   * `?page=<n>` (legacy) — offset pagination, fine for first dozen pages.
//
// Cursor mode skips the COUNT(*) query and returns only `nextCursor`/`hasMore`.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const search = searchParams.get("search") || "";
  const cursorRaw = searchParams.get("cursor");

  const baseWhere: Prisma.ReceiptWhereInput = {
    AND: [
      // Hide soft-deleted rows.
      { deletedAt: null },
      // User must be involved in the receipt
      {
        OR: [
          { createdById: user.id },
          { payerId: user.id },
          { items: { some: { assignments: { some: { userId: user.id } } } } },
          { trip: { members: { some: { userId: user.id } } } },
        ],
      },
      // Search filter
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { trip: { name: { contains: search, mode: "insensitive" as const } } },
              ],
            },
          ]
        : []),
    ],
  };

  // ---- Cursor mode (preferred) ----
  if (cursorRaw !== null) {
    const cursor = cursorRaw === "" ? null : decodeCursor(cursorRaw);
    if (cursorRaw !== "" && cursor === null) {
      return apiError("BAD_REQUEST", "Invalid cursor", { field: "cursor" });
    }

    const where: Prisma.ReceiptWhereInput = cursor
      ? {
          AND: [
            baseWhere,
            // Strict less-than on (createdAt, id) — tuple inequality.
            {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            },
          ],
        }
      : baseWhere;

    // Fetch one extra to know if there's a next page without an extra query.
    const rows = await prisma.receipt.findMany({
      where,
      select: {
        id: true,
        title: true,
        tax: true,
        service: true,
        date: true,
        createdAt: true,
        tripId: true,
        trip: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    return NextResponse.json({
      data: page.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date?.toISOString() ?? null,
        totalAmount: r.tax + r.service,
        participantCount: 0,
        createdAt: r.createdAt.toISOString(),
        tripName: r.trip?.name ?? null,
        tripId: r.tripId,
        itemCount: r._count.items,
      })),
      limit,
      hasMore,
      nextCursor,
    });
  }

  // ---- Offset mode (legacy) ----
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const skip = (page - 1) * limit;

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where: baseWhere,
      select: {
        id: true,
        title: true,
        tax: true,
        service: true,
        date: true,
        createdAt: true,
        tripId: true,
        trip: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.receipt.count({ where: baseWhere }),
  ]);

  return NextResponse.json({
    data: receipts.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date?.toISOString() ?? null,
      totalAmount: r.tax + r.service,
      participantCount: 0,
      createdAt: r.createdAt.toISOString(),
      tripName: r.trip?.name ?? null,
      tripId: r.tripId,
      itemCount: r._count.items,
    })),
    total,
    page,
    limit,
    hasMore: skip + limit < total,
  });
}

// POST /api/receipts - Create a standalone receipt
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "receipts:create", { userId: user.id });
  if (limited) return limited;

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
      tripId: input.tripId,
      participantsJson:
        (input.participantsJson as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
      createdById: user.id,
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
