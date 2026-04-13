import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

// GET /api/receipts/[id] - Get receipt detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      trip: { select: { name: true } },
      payer: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          assignments: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check if user is involved
  const isInvolved =
    receipt.createdById === user.id ||
    receipt.payerId === user.id ||
    receipt.items.some((item) =>
      item.assignments.some((a) => a.userId === user.id)
    );

  if (!isInvolved && receipt.tripId) {
    const membership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: { tripId: receipt.tripId, userId: user.id },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!isInvolved) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build participants list from assignments + payer
  const participantMap = new Map<string, { id: string; name: string }>();
  participantMap.set(receipt.payer.id, {
    id: receipt.payer.id,
    name: receipt.payer.name || receipt.payer.email,
  });
  receipt.items.forEach((item) => {
    item.assignments.forEach((a) => {
      if (!participantMap.has(a.user.id)) {
        participantMap.set(a.user.id, {
          id: a.user.id,
          name: a.user.name || a.user.email,
        });
      }
    });
  });

  // If the receipt has participantsJson (imported from localStorage), use that
  const participants = receipt.participantsJson
    ? (receipt.participantsJson as Array<{ id: string; name: string }>)
    : Array.from(participantMap.values());

  const formattedReceipt = {
    id: receipt.id,
    title: receipt.title,
    date: receipt.date?.toISOString() ?? null,
    tax: receipt.tax,
    service: receipt.service,
    payerId: receipt.payerId,
    createdById: receipt.createdById,
    tripId: receipt.tripId,
    tripName: receipt.trip?.name ?? null,
    participants,
    items: receipt.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      total: item.total,
      assignedToIds: item.assignments.map((a) => a.userId),
    })),
  };

  return NextResponse.json({ receipt: formattedReceipt });
}

// PUT /api/receipts/[id] - Update receipt
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.receipt.findUnique({
    where: { id },
    select: { createdById: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, payerId, tax, service, date } = body;

  const updated = await prisma.receipt.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(payerId !== undefined && { payerId }),
      ...(tax !== undefined && { tax }),
      ...(service !== undefined && { service }),
      ...(date !== undefined && { date: date ? new Date(date) : null }),
    },
    select: { id: true },
  });

  return NextResponse.json({ id: updated.id });
}

// DELETE /api/receipts/[id] - Delete receipt (creator only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.receipt.findUnique({
    where: { id },
    select: { createdById: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.receipt.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
