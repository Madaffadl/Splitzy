import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, forbidden, assertSameOrigin } from "@/lib/api-auth";
import { getTripAccess } from "@/lib/travel/trip-access";

export const runtime = "nodejs";

// DELETE /api/travel/[id]/invites/[token] — revoke an invite (owner only).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const { id, token } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();
  if (access.ownerId !== user.id) return forbidden("Only the trip owner can revoke invites");

  const result = await prisma.tripInvite.deleteMany({
    where: { token, tripId: id },
  });
  if (result.count === 0) return notFound();

  return NextResponse.json({ ok: true });
}
