import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAuthUser, forbidden, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { isAdminEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";

// PATCH /api/admin/users/[id]
// Supported actions (any combination in one request):
//   plan: "free" | "pro"           — change plan
//   resetQuota: true               — reset aiScanCount to 0
//   aiScanLimit: number | null     — set custom monthly scan limit (null = use plan default)
//   ban: true | false              — ban or unban the user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user || !isAdminEmail(user.email)) return forbidden();

  const { id } = await params;

  // Prevent admin from banning themselves.
  if (id === user.id) return forbidden("Cannot modify your own account");

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return apiError("BAD_REQUEST", "Invalid request body");

  const data: Prisma.UserUpdateInput = {};

  if (body.plan === "free" || body.plan === "pro") {
    data.plan = body.plan;
  }
  if (body.resetQuota === true) {
    data.aiScanCount = 0;
    data.aiScanResetAt = null;
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
  }
  if (body.ban === true) {
    data.bannedAt = new Date();
  } else if (body.ban === false) {
    data.bannedAt = null;
  }

  if (Object.keys(data).length === 0) {
    return apiError("BAD_REQUEST", "Nothing to update");
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return notFound();

  await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
