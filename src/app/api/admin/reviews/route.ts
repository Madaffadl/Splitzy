import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, forbidden } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin/admin-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const STATUSES = ["pending", "approved", "rejected"] as const;

// GET /api/admin/reviews — the moderation queue.
//
// Query params:
//   status — "pending" (default) | "approved" | "rejected" | "all"
//   cursor — id of the last row from the previous page (omit for page 1)
//   limit  — page size (default 20, capped at 100)
//
// Response: { reviews, nextCursor, stats }. As with the users route, `stats` is
// global and ignores the current filter, so the tab counters stay honest
// whichever tab is open.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !isAdmin(user)) return forbidden();

  const limited = enforceRateLimit(request, "admin:reviews", {
    userId: user.id,
    limit: 120,
  });
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const statusParam = sp.get("status") ?? "pending";
  const status = (STATUSES as readonly string[]).includes(statusParam)
    ? statusParam
    : "all";
  const cursor = sp.get("cursor") ?? null;
  const limit = Math.min(
    Math.max(1, parseInt(sp.get("limit") ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  const where: Prisma.ReviewWhereInput = status === "all" ? {} : { status };

  const rows = await prisma.review.findMany({
    where,
    include: {
      // Moderators need to see who wrote it, not just the name snapshot.
      user: { select: { email: true, name: true, avatarUrl: true } },
    },
    // Second key breaks ties deterministically when timestamps collide.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const [pending, approved, rejected] = await prisma.$transaction([
    prisma.review.count({ where: { status: "pending" } }),
    prisma.review.count({ where: { status: "approved" } }),
    prisma.review.count({ where: { status: "rejected" } }),
  ]);

  return NextResponse.json({
    reviews: page.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      // Both names travel: the snapshot is what would be published, and a
      // moderator should be able to see when it has drifted from the account.
      displayName: r.displayName,
      userName: r.user.name,
      userEmail: r.user.email,
      avatarUrl: r.user.avatarUrl,
      source: r.source,
      locale: r.locale,
      status: r.status,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    })),
    nextCursor,
    stats: { pending, approved, rejected },
  });
}
