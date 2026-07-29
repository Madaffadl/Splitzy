import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { getTripAccess, requireOwnerWrite } from "@/lib/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { applyChangeOps } from "@/lib/apply-change-ops";
import type { ChangeOp } from "@/lib/change-ops";

export const runtime = "nodejs";

// Thrown inside the transaction when another reviewer claimed the request first.
class AlreadyReviewed extends Error {}

// POST /api/travel/[id]/change-requests/[crid]/approve — owner applies the batch.
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

  const cr = await prisma.tripChangeRequest.findFirst({
    where: { id: crid, tripId: id },
    select: { id: true, status: true, authorId: true, ops: true },
  });
  if (!cr) return notFound();
  if (cr.status !== "pending") return apiError("BAD_REQUEST", "This change request was already reviewed.");

  const ops = cr.ops as unknown as ChangeOp[];

  try {
    const newVersion = await prisma.$transaction(async (tx) => {
      // Re-read the live participant set: approval is last-write-wins, so ops are
      // validated against whatever the trip looks like NOW, not at submit time.
      const trip = await tx.trip.findUnique({ where: { id }, select: { participantsJson: true, version: true } });
      if (!trip) throw new AlreadyReviewed();
      const participants = (trip.participantsJson as unknown as { id: string }[] | null) ?? [];
      const participantIds = new Set(participants.map((p) => p.id));

      await applyChangeOps(tx, id, ops, cr.authorId, participantIds);

      // Bump the trip version once so members' optimistic-lock reads stay correct.
      await tx.trip.update({ where: { id }, data: { version: { increment: 1 } } });

      // Atomically claim the request: if it's no longer pending, another reviewer
      // beat us — throw to roll back everything applied above.
      const claim = await tx.tripChangeRequest.updateMany({
        where: { id: crid, status: "pending" },
        data: { status: "approved", reviewedById: user.id, reviewedAt: new Date() },
      });
      if (claim.count === 0) throw new AlreadyReviewed();

      return trip.version + 1;
    });

    return NextResponse.json({ ok: true, status: "approved", version: newVersion });
  } catch (err) {
    if (err instanceof AlreadyReviewed) {
      return apiError("BAD_REQUEST", "This change request was already reviewed.");
    }
    if (err instanceof ValidationError) {
      // The trip changed since the proposal and it no longer applies cleanly.
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(
        { ...body, error: `Can't apply — the trip changed and this request no longer fits (${body.error}). Ask the member to resubmit.` },
        { status }
      );
    }
    console.error("[change-requests approve] failed:", err);
    return apiError("INTERNAL_ERROR", "Failed to apply the change request.");
  }
}
