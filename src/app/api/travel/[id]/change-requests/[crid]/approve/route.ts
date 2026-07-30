import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { getTripAccess, requireOwnerWrite } from "@/lib/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildChangeOpsWrites } from "@/lib/apply-change-ops";
import type { ChangeOp } from "@/lib/change-ops";

export const runtime = "nodejs";

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

  // Read the live participant set (approval is last-write-wins: ops are validated
  // against the trip as it looks NOW, not at submit time).
  const trip = await prisma.trip.findUnique({ where: { id }, select: { participantsJson: true } });
  if (!trip) return notFound();
  const participants = (trip.participantsJson as unknown as { id: string }[] | null) ?? [];
  const participantIds = new Set(participants.map((p) => p.id));

  // Validate + build the writes up front. An invalid op throws before any DB
  // call, so a stale/no-longer-applicable request is rejected cleanly (400).
  let writes;
  try {
    writes = buildChangeOpsWrites(id, ops, cr.authorId, participantIds);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(
        { ...body, error: `Can't apply — the trip changed and this request no longer fits (${body.error}). Ask the member to resubmit.` },
        { status }
      );
    }
    return apiError("BAD_REQUEST", "Invalid change request");
  }

  try {
    // Array-form transaction (PgBouncer-safe): apply every op, bump the trip
    // version, and claim the request — atomically. The claim's `status: pending`
    // guard makes a concurrent double-approve a no-op on the second caller.
    const results = await prisma.$transaction([
      ...writes,
      prisma.trip.update({ where: { id }, data: { version: { increment: 1 } }, select: { version: true } }),
      prisma.tripChangeRequest.updateMany({
        where: { id: crid, status: "pending" },
        data: { status: "approved", reviewedById: user.id, reviewedAt: new Date() },
      }),
    ]);

    const versionRow = results[results.length - 2] as { version: number };
    const claim = results[results.length - 1] as { count: number };
    if (claim.count === 0) {
      // Another reviewer claimed it first; our writes were idempotent upserts.
      return apiError("BAD_REQUEST", "This change request was already reviewed.");
    }

    return NextResponse.json({ ok: true, status: "approved", version: versionRow.version });
  } catch (err) {
    console.error("[change-requests approve] failed:", err);
    return apiError("INTERNAL_ERROR", "Failed to apply the change request.");
  }
}
