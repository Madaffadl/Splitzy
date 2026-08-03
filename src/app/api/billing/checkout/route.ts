import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, getAuthUser, unauthorized } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { isServerEnabled } from "@/lib/flags";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { PRO_PLAN } from "@/lib/billing/plans";
import { isProActive } from "@/lib/billing/entitlements";
import { createInvoice, isXenditConfigured } from "@/lib/billing/xendit";

// Starts a Xendit checkout for Splitzy Pro. Dark until launch: 404s when the
// FLAG_XENDIT_CHECKOUT flag is OFF, so the endpoint doesn't exist for users
// until we deliberately turn revenue on.
export async function POST(request: NextRequest) {
  if (!isServerEnabled("xenditCheckout")) {
    return apiError("NOT_FOUND", "Not found");
  }

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  // Don't let an already-Pro user pay again by accident.
  if (isProActive(user)) {
    return apiError("BAD_REQUEST", "You already have an active Pro plan.");
  }

  const limited = await enforceRateLimitAsync(request, "billing:checkout", {
    userId: user.id,
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  // Flag could be ON before keys are provisioned — guard explicitly.
  if (!isXenditConfigured()) {
    return apiError("INTERNAL_ERROR", "Payments are not configured");
  }

  const externalId = `pro_${user.id}_${Date.now()}`;
  const origin = new URL(request.url).origin;

  // Persist the pending payment BEFORE calling Xendit so the webhook always has
  // a row to reconcile against, even if the response is lost.
  await prisma.payment.create({
    data: {
      userId: user.id,
      externalId,
      amount: PRO_PLAN.priceIDR,
      currency: PRO_PLAN.currency,
      status: "pending",
      plan: PRO_PLAN.id,
      periodDays: PRO_PLAN.periodDays,
    },
  });

  try {
    const invoice = await createInvoice({
      externalId,
      amount: PRO_PLAN.priceIDR,
      payerEmail: user.email,
      description: `Splitzy Pro — ${PRO_PLAN.periodDays} days of unlimited AI scans`,
      successRedirectUrl: `${origin}/pricing?status=success`,
      failureRedirectUrl: `${origin}/pricing?status=failed`,
    });

    await prisma.payment.update({
      where: { externalId },
      data: { xenditId: invoice.id, invoiceUrl: invoice.invoiceUrl },
    });

    return NextResponse.json({ invoiceUrl: invoice.invoiceUrl });
  } catch (err) {
    console.error("Xendit checkout failed:", err);
    await prisma.payment
      .update({ where: { externalId }, data: { status: "failed" } })
      .catch(() => {});
    return apiError("INTERNAL_ERROR", "Could not start checkout. Please try again.");
  }
}
