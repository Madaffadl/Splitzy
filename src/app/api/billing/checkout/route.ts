import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, getAuthUser, unauthorized } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { isServerEnabled } from "@/lib/flags";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { PRO_PLAN, getProPlanVariant } from "@/lib/billing/plans";
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

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const planVariantId = typeof body?.planId === "string" ? body.planId : null;
  const planVariant = planVariantId ? getProPlanVariant(planVariantId) : null;

  // Fall back to the default 30-day plan if no valid planId is supplied.
  const selectedPlan = planVariant ?? {
    periodDays: PRO_PLAN.periodDays,
    priceIDR: PRO_PLAN.priceIDR,
    label: "30 Hari",
  };

  const externalId = `pro_${user.id}_${Date.now()}`;
  const origin = new URL(request.url).origin;

  // Persist the pending payment BEFORE calling Xendit so the webhook always has
  // a row to reconcile against, even if the response is lost.
  await prisma.payment.create({
    data: {
      userId: user.id,
      externalId,
      amount: selectedPlan.priceIDR,
      currency: PRO_PLAN.currency,
      status: "pending",
      plan: PRO_PLAN.id,
      periodDays: selectedPlan.periodDays,
    },
  });

  try {
    const invoice = await createInvoice({
      externalId,
      amount: selectedPlan.priceIDR,
      payerEmail: user.email,
      description: `Splitzy Pro — ${selectedPlan.periodDays} days of unlimited AI scans`,
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
