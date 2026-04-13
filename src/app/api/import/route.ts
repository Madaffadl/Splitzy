import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

interface LocalParticipant {
  id: string;
  name: string;
}

interface LocalItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  assignedToIds: string[];
}

interface LocalReceipt {
  id: string;
  title: string;
  date?: string;
  payerId: string;
  items: LocalItem[];
  tax: number;
  service: number;
}

interface LocalSingleState {
  participants: LocalParticipant[];
  items: LocalItem[];
  title: string;
  tax: number;
  service: number;
  payerId: string;
}

interface LocalTripState {
  trip: {
    id: string;
    name: string;
    participants: LocalParticipant[];
    receipts: LocalReceipt[];
  };
}

// POST /api/import - Import localStorage data into user's account
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { single, trip } = body as {
    single: LocalSingleState | null;
    trip: LocalTripState | null;
  };

  let importedCount = 0;

  // Import single receipt
  if (single && single.items.length > 0) {
    await prisma.receipt.create({
      data: {
        title: single.title || "Imported Receipt",
        payerId: user.id,
        tax: single.tax || 0,
        service: single.service || 0,
        createdById: user.id,
        participantsJson: single.participants as unknown as Prisma.InputJsonValue,
        items: {
          create: single.items.map((item, index) => ({
            name: item.name,
            qty: item.qty || 1,
            unitPrice: item.unitPrice,
            total: item.total,
            sortOrder: index,
          })),
        },
      },
    });
    importedCount++;
  }

  // Import trip receipts
  if (trip && trip.trip.receipts.length > 0) {
    // Create a trip record
    const dbTrip = await prisma.trip.create({
      data: {
        name: trip.trip.name || "Imported Trip",
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });

    // Create each receipt in the trip
    for (const receipt of trip.trip.receipts) {
      await prisma.receipt.create({
        data: {
          title: receipt.title || "Untitled Receipt",
          payerId: user.id,
          tax: receipt.tax || 0,
          service: receipt.service || 0,
          date: receipt.date ? new Date(receipt.date) : null,
          tripId: dbTrip.id,
          createdById: user.id,
          participantsJson: trip.trip.participants as unknown as Prisma.InputJsonValue,
          items: {
            create: receipt.items.map((item, index) => ({
              name: item.name,
              qty: item.qty || 1,
              unitPrice: item.unitPrice,
              total: item.total,
              sortOrder: index,
            })),
          },
        },
      });
      importedCount++;
    }
  }

  return NextResponse.json({ imported: importedCount });
}
