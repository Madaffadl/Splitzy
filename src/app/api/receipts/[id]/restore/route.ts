import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthUser,
  unauthorized,
  forbidden,
  notFound,
  assertSameOrigin,
} from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

// POST /api/receipts/[id]/restore - Un-soft-delete a receipt the caller created.
//
// Pairs with the soft-delete in DELETE /api/receipts/[id]. We expose a
// dedicated endpoint (rather than letting PUT toggle deletedAt) so it's
// auditable and can be permission-gated separately later.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "receipts:restore", {
    userId: user.id,
    limit: 20,
  });
  if (limited) return limited;

  const { id } = await params;

  const existing = await prisma.receipt.findUnique({
    where: { id },
    select: { createdById: true, deletedAt: true },
  });

  if (!existing) return notFound();
  if (existing.createdById !== user.id) return forbidden();
  if (!existing.deletedAt) {
    // Already active — make the endpoint idempotent.
    return NextResponse.json({ id, restored: false });
  }

  await prisma.receipt.update({
    where: { id },
    data: { deletedAt: null, version: { increment: 1 } },
  });

  return NextResponse.json({ id, restored: true });
}
