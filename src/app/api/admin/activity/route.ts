import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, forbidden } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin/admin-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// GET /api/admin/activity?from=<iso>&to=<iso> — user activity within a window
// (admin only). The client sends the selected calendar day as [from, to) in the
// admin's local time, so "today" matches the operator's wall clock rather than a
// server-guessed timezone. Defaults to the last 24 hours.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !isAdmin(user)) return forbidden();

  const limited = enforceRateLimit(request, "admin:activity", { userId: user.id, limit: 120 });
  if (limited) return limited;

  const url = new URL(request.url);
  const now = Date.now();
  const from = parseDate(url.searchParams.get("from")) ?? new Date(now - 24 * 60 * 60 * 1000);
  const to = parseDate(url.searchParams.get("to")) ?? new Date(now);
  if (from >= to) return apiError("BAD_REQUEST", "`from` must be before `to`");

  const where = { createdAt: { gte: from, lt: to } };

  // Detailed feed (capped) + exact DB-side aggregates. The aggregates use
  // COUNT(DISTINCT …) FILTER so the summary counters are always correct
  // regardless of window size — never truncated, and no rows shipped to Node
  // just to be counted. The existing createdAt index serves the range scan.
  const [events, aggRows] = await Promise.all([
    prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, userEmail: true, feature: true, type: true, metadata: true, createdAt: true },
    }),
    prisma.$queryRaw<
      {
        active_users: bigint;
        logins: bigint;
        single: bigint;
        multiple: bigint;
        travel: bigint;
      }[]
    >(Prisma.sql`
      SELECT
        COUNT(DISTINCT user_id)                                          AS active_users,
        COUNT(DISTINCT user_id) FILTER (WHERE type = 'login')            AS logins,
        COUNT(DISTINCT user_id) FILTER (WHERE feature = 'single')        AS single,
        COUNT(DISTINCT user_id) FILTER (WHERE feature = 'multiple')      AS multiple,
        COUNT(DISTINCT user_id) FILTER (WHERE feature = 'travel')        AS travel
      FROM activity_events
      WHERE created_at >= ${from} AND created_at < ${to}
    `),
  ]);

  const agg = aggRows[0];

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    // Aggregates are now computed DB-side over the full window — never truncated.
    truncated: false,
    summary: {
      activeUsers: Number(agg?.active_users ?? 0),
      logins: Number(agg?.logins ?? 0),
      byFeature: {
        single: Number(agg?.single ?? 0),
        multiple: Number(agg?.multiple ?? 0),
        travel: Number(agg?.travel ?? 0),
      },
    },
    events: events.map((e) => ({
      id: e.id,
      userEmail: e.userEmail,
      feature: e.feature,
      type: e.type,
      metadata: (e.metadata as Record<string, unknown> | null) ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
