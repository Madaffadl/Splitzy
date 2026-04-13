import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

// GET /api/trips/[id] - Get trip with members and receipts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
      receipts: {
        include: {
          payer: { select: { id: true, name: true } },
          items: {
            include: {
              assignments: {
                select: { userId: true },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check membership
  const isMember = trip.members.some((m) => m.userId === user.id);
  if (!isMember && trip.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    trip: {
      id: trip.id,
      name: trip.name,
      ownerId: trip.ownerId,
      owner: trip.owner,
      members: trip.members.map((m) => ({
        id: m.user.id,
        name: m.user.name || m.user.email,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
      })),
      receipts: trip.receipts.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date?.toISOString() ?? null,
        payerId: r.payerId,
        payerName: r.payer.name,
        tax: r.tax,
        service: r.service,
        items: r.items.map((item) => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          total: item.total,
          assignedToIds: item.assignments.map((a) => a.userId),
        })),
      })),
      createdAt: trip.createdAt.toISOString(),
    },
  });
}

// PUT /api/trips/[id] - Update trip
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (trip.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name } = body;

  const updated = await prisma.trip.update({
    where: { id },
    data: { ...(name !== undefined && { name }) },
    select: { id: true },
  });

  return NextResponse.json({ id: updated.id });
}

// DELETE /api/trips/[id] - Delete trip (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (trip.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.trip.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
