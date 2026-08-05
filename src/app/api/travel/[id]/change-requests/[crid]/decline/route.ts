import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { getTripAccess, requireOwnerWrite } from "@/lib/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { broadcastTripChange } from "@/lib/realtime";

export const runtime = "nodejs";

// POST /api/travel/[id]/change-requests/[crid]/decline — owner rejects the batch.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; crid: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:changereq", { userId: user.id, limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  const { id, crid } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();
  const gate = requireOwnerWrite(access); // owner only
  if (gate) return gate;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reviewNote =
    typeof body?.reviewNote === "string" ? body.reviewNote.trim().slice(0, 500) || null : null;

  // Only a pending request can be declined (atomic claim guards a double review).
  const result = await prisma.tripChangeRequest.updateMany({
    where: { id: crid, tripId: id, status: "pending" },
    data: { status: "declined", reviewNote, reviewedById: user.id, reviewedAt: new Date() },
  });
  if (result.count === 0) {
    return apiError("BAD_REQUEST", "This change request was already reviewed.");
  }

  // Notify the author's client that their request was reviewed.
  await broadcastTripChange(id, { kind: "changeRequest", actorId: user.id });
  return NextResponse.json({ ok: true, status: "declined" });
}
