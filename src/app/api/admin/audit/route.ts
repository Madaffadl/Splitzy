import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, forbidden } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin/admin-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// GET /api/admin/audit — most recent privileged admin actions (admin only).
// Newest first, capped; this is an operational activity feed, not an export.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !isAdmin(user)) return forbidden();

  const limited = enforceRateLimit(request, "admin:audit", { userId: user.id, limit: 120 });
  if (limited) return limited;

  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      actorEmail: l.actorEmail,
      action: l.action,
      targetEmail: l.targetEmail,
      metadata: (l.metadata as Record<string, unknown> | null) ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
