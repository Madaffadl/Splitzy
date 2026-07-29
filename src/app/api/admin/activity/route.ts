import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, forbidden } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin-auth";
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

  // Detailed feed (capped) + a lightweight projection for accurate aggregates.
  const [events, all] = await Promise.all([
    prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, userEmail: true, feature: true, type: true, metadata: true, createdAt: true },
    }),
    prisma.activityEvent.findMany({
      where,
      take: 5000,
      select: { userId: true, feature: true, type: true },
    }),
  ]);

  // Distinct users overall, per feature, and who signed in.
  const activeUsers = new Set<string>();
  const logins = new Set<string>();
  const byFeature: Record<string, Set<string>> = { single: new Set(), multiple: new Set(), travel: new Set() };
  for (const e of all) {
    activeUsers.add(e.userId);
    if (e.type === "login") logins.add(e.userId);
    if (e.feature in byFeature) byFeature[e.feature].add(e.userId);
  }

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    truncated: all.length >= 5000,
    summary: {
      activeUsers: activeUsers.size,
      logins: logins.size,
      byFeature: {
        single: byFeature.single.size,
        multiple: byFeature.multiple.size,
        travel: byFeature.travel.size,
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
