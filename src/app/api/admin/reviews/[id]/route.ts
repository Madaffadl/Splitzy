import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertSameOrigin,
  getAuthUser,
  forbidden,
  notFound,
} from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin/admin-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_REVIEW_NOTE = 500;

// PATCH /api/admin/reviews/[id] — approve or reject a submitted review.
// Body: { action: "approve" | "reject", reviewNote?: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user || !isAdmin(user)) return forbidden();

  const limited = enforceRateLimit(request, "admin:mutate", {
    userId: user.id,
    limit: 40,
  });
  if (limited) return limited;

  const { id } = await params;
  // A @db.Uuid column rejects a non-UUID at the driver level and Prisma 500s,
  // so a malformed path segment has to answer 404 before it reaches the query.
  if (!isUuid(id)) return notFound();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return apiError("BAD_REQUEST", "Invalid request body");

  if (body.action !== "approve" && body.action !== "reject") {
    return apiError("BAD_REQUEST", "action must be 'approve' or 'reject'");
  }
  const nextStatus = body.action === "approve" ? "approved" : "rejected";
  const reviewNote =
    typeof body.reviewNote === "string"
      ? body.reviewNote.trim().slice(0, MAX_REVIEW_NOTE) || null
      : null;

  // Snapshot for the audit row. Read separately because the audit entry needs
  // the *previous* status, and the update below overwrites it.
  const target = await prisma.review.findUnique({
    where: { id },
    select: {
      rating: true,
      status: true,
      userId: true,
      user: { select: { email: true } },
    },
  });
  if (!target) return notFound();

  try {
    // Two invariants meet here and neither can bend:
    //   - the claim must be atomic, so two admins clicking at once cannot both
    //     "win" (the read-then-write above is only a snapshot, not a lock)
    //   - the audit row must commit in the same transaction as the mutation,
    //     so an action that cannot be recorded is never applied
    // The array form of $transaction cannot branch on an updateMany count, and
    // PgBouncer transaction pooling rules out the interactive form entirely.
    // Extended where-unique threads both: `id` is the unique key and `status`
    // an extra filter, so a no-match throws P2025 and rolls the audit back with
    // it rather than leaving an orphan entry.
    //
    // `not: nextStatus` rather than `status: "pending"` on purpose — it lets an
    // admin take down an already-approved review by rejecting it, which is the
    // only recall mechanism there is, while a double-click is still a no-op.
    const [updated] = await prisma.$transaction([
      prisma.review.update({
        where: { id, status: { not: nextStatus } },
        data: {
          status: nextStatus,
          reviewNote,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      }),
      prisma.adminAuditLog.createMany({
        data: [
          {
            actorId: user.id,
            actorEmail: user.email,
            targetUserId: target.userId,
            targetEmail: target.user.email,
            action: body.action === "approve" ? "review.approve" : "review.reject",
            metadata: { rating: target.rating, from: target.status },
          },
        ],
      }),
    ]);

    return NextResponse.json({
      review: {
        id: updated.id,
        status: updated.status,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return apiError("BAD_REQUEST", `This review is already ${nextStatus}.`);
    }
    throw err;
  }
}
