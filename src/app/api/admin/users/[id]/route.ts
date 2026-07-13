import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAuthUser, forbidden, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { isAdmin, isBootstrapAdmin } from "@/lib/admin-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// PATCH /api/admin/users/[id]
// Supported actions (any combination in one request):
//   plan: "free" | "pro"           — change plan
//   resetQuota: true               — reset aiScanCount to 0
//   aiScanLimit: number | null     — set custom monthly scan limit (null = use plan default)
//   ban: true | false              — ban or unban the user
//   role: "admin" | "user"         — grant or revoke admin access
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user || !isAdmin(user)) return forbidden();

  const limited = enforceRateLimit(request, "admin:mutate", { userId: user.id, limit: 40 });
  if (limited) return limited;

  const { id } = await params;
  const isSelf = id === user.id;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return apiError("BAD_REQUEST", "Invalid request body");

  // Lockout guards only: an admin MAY change their own plan/quota, but must not
  // ban themselves or drop their own admin role (either would lock them out).
  // Everything else on their own account is harmless and allowed.
  if (isSelf && body.ban === true) return forbidden("You can't ban your own account");
  if (isSelf && body.role === "user") return forbidden("You can't revoke your own admin role");

  // Load the current state up front so the audit trail can record before→after.
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, plan: true, aiScanCount: true, aiScanLimit: true, bannedAt: true, role: true },
  });
  if (!target) return notFound();

  const data: Prisma.UserUpdateInput = {};
  const audit: Prisma.AdminAuditLogCreateManyInput[] = [];
  const actor = { actorId: user.id, actorEmail: user.email, targetUserId: target.id, targetEmail: target.email };

  if (body.plan === "free" || body.plan === "pro") {
    data.plan = body.plan;
    audit.push({ ...actor, action: "plan.change", metadata: { from: target.plan, to: body.plan } });
  }
  if (body.resetQuota === true) {
    data.aiScanCount = 0;
    data.aiScanResetAt = null;
    audit.push({ ...actor, action: "quota.reset", metadata: { from: target.aiScanCount } });
  }
  if ("aiScanLimit" in body) {
    const lim = body.aiScanLimit;
    if (lim === null) {
      data.aiScanLimit = null;
    } else if (typeof lim === "number" && Number.isInteger(lim) && lim >= 0 && lim <= 10000) {
      data.aiScanLimit = lim;
    } else {
      return apiError("BAD_REQUEST", "aiScanLimit must be a non-negative integer ≤ 10000, or null");
    }
    audit.push({ ...actor, action: "quota.limit", metadata: { from: target.aiScanLimit, to: lim } });
  }
  if (body.ban === true) {
    data.bannedAt = new Date();
    audit.push({ ...actor, action: "user.ban" });
  } else if (body.ban === false) {
    data.bannedAt = null;
    audit.push({ ...actor, action: "user.unban" });
  }
  if (body.role === "admin" || body.role === "user") {
    // A bootstrap admin's access comes from the allowlist, not the DB, so
    // revoking their role would be a no-op that misrepresents the audit trail.
    if (body.role === "user" && isBootstrapAdmin(target.email)) {
      return apiError("BAD_REQUEST", "Cannot revoke a bootstrap admin");
    }
    if (body.role !== target.role) {
      data.role = body.role;
      audit.push({
        ...actor,
        action: body.role === "admin" ? "role.grant" : "role.revoke",
        metadata: { from: target.role, to: body.role },
      });
    }
  }

  if (Object.keys(data).length === 0) {
    return apiError("BAD_REQUEST", "Nothing to update");
  }

  // Update + audit are one transaction: an action that can't be recorded is
  // never applied, so the trail can never silently miss a change.
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data,
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
        // Active trips only — keep consistent with the list + drawer.
        _count: { select: { ownedTrips: { where: { deletedAt: null } } } },
      },
    }),
    prisma.adminAuditLog.createMany({ data: audit }),
  ]);

  // Return the fresh row (list shape) so the client can update in place — no
  // full refetch needed, and the open drawer reflects the change immediately.
  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      plan: updated.plan,
      aiScanCount: updated.aiScanCount,
      aiScanResetAt: updated.aiScanResetAt?.toISOString() ?? null,
      aiScanLimit: updated.aiScanLimit,
      bannedAt: updated.bannedAt?.toISOString() ?? null,
      role: updated.role,
      isAdmin: isAdmin(updated),
      bootstrapAdmin: isBootstrapAdmin(updated.email),
      tripCount: updated._count.ownedTrips,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}
