// Authorization helper for Travel Spend cloud trips: a user may read/write a
// trip only if they own it or are a member, and it isn't soft-deleted.

import { prisma } from "@/lib/prisma";

export interface TripAccess {
  id: string;
  ownerId: string;
  version: number;
}

/** Returns minimal trip info if the user has access, else null. */
export async function getTripAccess(
  tripId: string,
  userId: string
): Promise<TripAccess | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      ownerId: true,
      version: true,
      deletedAt: true,
      members: { select: { userId: true } },
    },
  });
  if (!trip || trip.deletedAt) return null;
  const allowed = trip.ownerId === userId || trip.members.some((m) => m.userId === userId);
  return allowed ? { id: trip.id, ownerId: trip.ownerId, version: trip.version } : null;
}
