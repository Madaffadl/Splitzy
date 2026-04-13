import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

// POST /api/trips/[id]/receipts - Add a receipt to a trip
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id: tripId } = await params;

  // Check trip membership
  const membership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: user.id } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, payerId, tax, service, date, items } = body;

  if (!title || !items || !Array.isArray(items)) {
    return NextResponse.json(
      { error: "Missing required fields" },
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
      tripId,
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
              create: (item.assignedToUserIds || []).map(
                (userId: string) => ({
                  userId,
                })
              ),
            },
          })
        ),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: receipt.id }, { status: 201 });
}
