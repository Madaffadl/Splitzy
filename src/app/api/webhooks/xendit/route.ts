import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { isServerEnabled } from "@/lib/flags";
import { prisma } from "@/lib/prisma";
import { extendProExpiry } from "@/lib/billing/entitlements";
import { isXenditWebhookConfigured, verifyWebhookToken } from "@/lib/billing/xendit";

// Xendit invoice status callback. This is NOT same-origin (Xendit's servers
// call it), so CSRF origin checks don't apply — we authenticate with the
// x-callback-token header instead. Idempotent: a duplicate "paid" delivery is a
// no-op thanks to the atomic status claim below.
//
// Uses sequential single-statement writes (no interactive transaction) to stay
// safe over the Supabase PgBouncer transaction pooler.
export async function POST(request: NextRequest) {
  if (!isServerEnabled("xenditCheckout") || !isXenditWebhookConfigured()) {
    return apiError("NOT_FOUND", "Not found");
  }

  if (!verifyWebhookToken(request.headers.get("x-callback-token"))) {
    return apiError("UNAUTHORIZED", "Invalid callback token");
  }

  const body = await request.json().catch(() => null);
  const externalId = typeof body?.external_id === "string" ? body.external_id : null;
  const status = typeof body?.status === "string" ? body.status.toUpperCase() : null;
  if (!externalId || !status) {
    return apiError("BAD_REQUEST", "Missing external_id or status");
  }

  const payment = await prisma.payment.findUnique({ where: { externalId } });
  // Unknown invoice → ack 200 so Xendit stops retrying; nothing to reconcile.
  if (!payment) {
    console.warn("Xendit webhook for unknown external_id:", externalId);
    return NextResponse.json({ received: true });
  }

  if (status === "PAID" || status === "SETTLED") {
    // Atomically claim: count === 0 means a prior delivery already processed it.
    const claim = await prisma.payment.updateMany({
      where: { externalId, status: { not: "paid" } },
      data: {
        status: "paid",
        paidAt: new Date(),
        xenditId: typeof body?.id === "string" ? body.id : payment.xenditId,
      },
    });
    if (claim.count === 0) {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const buyer = await prisma.user.findUnique({
      where: { id: payment.userId },
      select: { proExpiresAt: true },
    });
    const newExpiry = extendProExpiry(buyer?.proExpiresAt ?? null, payment.periodDays);
    await prisma.user.update({
      where: { id: payment.userId },
      data: { plan: "pro", proExpiresAt: newExpiry },
    });
    return NextResponse.json({ received: true });
  }

  if (status === "EXPIRED") {
    await prisma.payment.updateMany({
      where: { externalId, status: "pending" },
      data: { status: "expired" },
    });
  }

  return NextResponse.json({ received: true });
}
