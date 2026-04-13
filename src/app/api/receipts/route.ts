import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

// GET /api/receipts - List receipts for authenticated user (paginated)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const search = searchParams.get("search") || "";
  const skip = (page - 1) * limit;

  const where = {
    AND: [
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

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      include: {
        trip: { select: { name: true } },
        items: { select: { id: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.receipt.count({ where }),
  ]);

  const data = receipts.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date?.toISOString() ?? null,
    totalAmount:
      r.items.length > 0
        ? r.tax + r.service // Will be calculated properly on detail page
        : 0,
    participantCount: 0, // Will come from detail query
    createdAt: r.createdAt.toISOString(),
    tripName: r.trip?.name ?? null,
    tripId: r.tripId,
    itemCount: r._count.items,
  }));

  return NextResponse.json({
    data,
    total,
    page,
    limit,
    hasMore: skip + limit < total,
  });
}

// POST /api/receipts - Create a standalone receipt
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { title, payerId, tax, service, date, tripId, participantsJson, items } = body;

  if (!title || !items || !Array.isArray(items)) {
    return NextResponse.json(
      { error: "Missing required fields: title, items" },
      { status: 400 }
    );
  }

  const receipt = await prisma.receipt.create({
    data: {
      title,
      payerId: payerId || user.id,
      tax: tax || 0,
      service: service || 0,
      date: date ? new Date(date) : null,
      tripId: tripId || null,
      participantsJson: participantsJson || null,
      createdById: user.id,
      items: {
        create: items.map(
          (
            item: {
              name: string;
              qty: number;
              unitPrice: number;
              total: number;
              assignedToUserIds?: string[];
            },
            index: number
          ) => ({
            name: item.name,
            qty: item.qty || 1,
            unitPrice: item.unitPrice,
            total: item.total,
            sortOrder: index,
            assignments: {
              create: (item.assignedToUserIds || []).map((userId: string) => ({
                userId,
              })),
            },
          })
        ),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: receipt.id }, { status: 201 });
}
