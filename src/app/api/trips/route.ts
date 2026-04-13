import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

// GET /api/trips - List trips for authenticated user
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    include: {
      _count: {
        select: { receipts: true, members: true },
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
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { name } = body;

  if (!name) {
    return NextResponse.json(
      { error: "Trip name is required" },
      { status: 400 }
    );
  }

  const trip = await prisma.trip.create({
    data: {
      name,
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
