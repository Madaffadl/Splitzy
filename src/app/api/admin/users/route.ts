import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, forbidden } from "@/lib/api-auth";
import { isAdmin, isBootstrapAdmin } from "@/lib/admin-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// GET /api/admin/users — paginated user list with scan quota + trip stats.
//
// Query params:
//   q      — search email/name (case-insensitive, contains)
//   plan   — "all" | "free" | "pro" | "banned"
//   cursor — id of the last row from the previous page (omit for page 1)
//   limit  — page size (default 25, capped at 100)
//
// Response: { users, nextCursor, stats }. `stats` is always global (across all
// users, independent of the current filter) so the dashboard counters stay
// honest no matter which page or filter is in view.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  // bannedAt guard is already in getAuthUser; admins should never be banned.
  if (!user || !isAdmin(user)) return forbidden();

  const limited = enforceRateLimit(request, "admin:users", { userId: user.id, limit: 120 });
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const plan = sp.get("plan") ?? "all";
  const cursor = sp.get("cursor") ?? null;
  const limit = Math.min(
    Math.max(1, parseInt(sp.get("limit") ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  // Build the filter from search + plan tab.
  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  if (plan === "banned") {
    where.bannedAt = { not: null };
  } else if (plan === "free" || plan === "pro") {
    where.bannedAt = null;
    where.plan = plan;
  }

  // Fetch one extra row to detect whether another page exists. Order by
  // createdAt then id so the cursor is fully deterministic across ties.
  const rows = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      plan: true,
      aiScanCount: true,
      aiScanResetAt: true,
      aiScanLimit: true,
      bannedAt: true,
      role: true,
      createdAt: true,
      // Active trips only — must match the drawer's trip list (deletedAt: null),
      // otherwise the "Trips" column overstates by counting soft-deleted rows.
      _count: { select: { ownedTrips: { where: { deletedAt: null } } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  // Global counters (all users, ignoring the current filter/search).
  const [total, proCount, bannedCount, scanAgg] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { plan: "pro", bannedAt: null } }),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.user.aggregate({ _sum: { aiScanCount: true } }),
  ]);

  return NextResponse.json({
    users: page.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      plan: u.plan,
      aiScanCount: u.aiScanCount,
      aiScanResetAt: u.aiScanResetAt?.toISOString() ?? null,
      aiScanLimit: u.aiScanLimit,
      bannedAt: u.bannedAt?.toISOString() ?? null,
      role: u.role,
      // Effective admin (DB role OR bootstrap email) + whether the row is a
      // bootstrap admin (whose access can't be revoked from the UI).
      isAdmin: isAdmin(u),
      bootstrapAdmin: isBootstrapAdmin(u.email),
      tripCount: u._count.ownedTrips,
      createdAt: u.createdAt.toISOString(),
    })),
    nextCursor,
    stats: {
      total,
      pro: proCount,
      banned: bannedCount,
      scans: scanAgg._sum.aiScanCount ?? 0,
    },
  });
}
