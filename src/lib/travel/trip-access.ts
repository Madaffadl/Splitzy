// Authorization helper for Travel Spend cloud trips: a user may read/write a
// trip only if they own it or are a member, and it isn't soft-deleted.

import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { isUuid } from "@/lib/validation";

export interface TripAccess {
  id: string;
  ownerId: string;
  version: number;
  // The requester's role on this trip. Owners write the trip directly; members
  // must route mutations through the change-request (approval) workflow.
  role: "owner" | "member";
}

/** Returns minimal trip info if the user has access, else null. */
export async function getTripAccess(
  tripId: string,
  userId: string
): Promise<TripAccess | null> {
  // `Trip.id` is a uuid column: a malformed path segment can never match a row,
  // but handing it to Prisma throws instead of missing. Every /api/travel/[id]
  // route funnels through here, so one guard turns that whole class of 500 into
  // the 404 it always was.
  if (!isUuid(tripId)) return null;
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
  const isOwner = trip.ownerId === userId;
  const isMember = trip.members.some((m) => m.userId === userId);
  if (!isOwner && !isMember) return null;
  return {
    id: trip.id,
    ownerId: trip.ownerId,
    version: trip.version,
    role: isOwner ? "owner" : "member",
  };
}

/**
 * Gate a direct trip mutation to owners only. Returns a 403 response for
 * members (who must submit a change request for review) or null for owners.
 * Call after `getTripAccess` on every endpoint that writes canonical trip state.
 */
export function requireOwnerWrite(access: TripAccess): NextResponse | null {
  if (access.role === "owner") return null;
  return apiError(
    "REVIEW_REQUIRED",
    "Members can't edit this trip directly — submit your changes for the owner to review."
  );
}
