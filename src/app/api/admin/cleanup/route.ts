import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;

/**
 * POST /api/admin/cleanup — Hard-delete rows that have been soft-deleted for
 * longer than the retention window. Designed to be called by a scheduled job
 * (Vercel Cron, GitHub Actions, external cron, etc.).
 *
 * Auth model:
 *   * Requires `Authorization: Bearer <CLEANUP_TOKEN>` matching the env var.
 *   * Falls back to Vercel's built-in `x-vercel-cron: 1` header when the
 *     request comes from Vercel Cron (Vercel signs cron requests).
 *   * Both checks fail-closed: missing env var → 503 (intentional misconfig
 *     guard so the endpoint doesn't accidentally run open).
 *
 * Behaviour: hard-deletes receipts first (children), then trips (parents).
 * Cascades from FK constraints clean up receipt_items and item_assignments.
 */
export async function POST(request: NextRequest) {
  const token = process.env.CLEANUP_TOKEN;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token && !isVercelCron) {
    // Misconfigured: env var unset and not a trusted Vercel cron caller.
    return NextResponse.json(
      { error: "Cleanup endpoint is not configured. Set CLEANUP_TOKEN." },
      { status: 503 }
    );
  }
  if (!isVercelCron && (!token || provided !== token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Order matters: receipts (FK to trips), then trips. Both have FK Cascade
  // on ReceiptItem & ItemAssignment so children clean up automatically.
  // Shared links are purged the moment they expire (their own TTL governs
  // lifetime), independent of the soft-delete retention window above.
  const [
    receiptsDeleted,
    lapsedSplitsDeleted,
    tripsDeleted,
    sharesDeleted,
    activityDeleted,
    invitesDeleted,
  ] = await prisma.$transaction([
      prisma.receipt.deleteMany({
        where: { deletedAt: { lt: cutoff, not: null } },
      }),
      // Saved single/multiple splits carry their own TTL, reset on every save.
      // They are a working copy, not an archive — the durable record of a
      // finished split is the text the user copied into their chat app — so
      // they're purged the moment they lapse, like shared links and invites.
      // Travel receipts have expiresAt = NULL and are never swept here.
      prisma.receipt.deleteMany({
        where: { expiresAt: { lt: now, not: null } },
      }),
      prisma.trip.deleteMany({
        where: { deletedAt: { lt: cutoff, not: null } },
      }),
      prisma.sharedSummary.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      // Activity log is telemetry, not user data — sweep by age (not soft-delete).
      prisma.activityEvent.deleteMany({
        where: { createdAt: { lt: cutoff } },
      }),
      // Trip invites carry their own 7-day TTL — purge the moment they expire,
      // independent of the soft-delete retention window (they're self-expiring).
      prisma.tripInvite.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);

  return NextResponse.json({
    cutoff: cutoff.toISOString(),
    retentionDays: RETENTION_DAYS,
    receiptsDeleted: receiptsDeleted.count,
    lapsedSplitsDeleted: lapsedSplitsDeleted.count,
    tripsDeleted: tripsDeleted.count,
    expiredSharesDeleted: sharesDeleted.count,
    activityEventsDeleted: activityDeleted.count,
    expiredInvitesDeleted: invitesDeleted.count,
  });
}

/** Allow GET for monitoring tools that prefer it (still requires auth). */
export const GET = POST;
