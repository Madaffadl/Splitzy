import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { getTripAccess } from "@/lib/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// DELETE /api/travel/[id]/payments/[pid] — remove a recorded settle-up payment.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:payment", { userId: user.id, limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  const { id, pid } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();

  const result = await prisma.tripPayment.deleteMany({ where: { id: pid, tripId: id } });
  if (result.count === 0) return notFound();

  return NextResponse.json({ ok: true });
}
