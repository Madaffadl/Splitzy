import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator, Check, CheckCircle2 } from "lucide-react";
import { isEnabled, isServerEnabled } from "@/lib/flags";
import { isXenditConfigured } from "@/lib/billing/xendit";
import {
  FREE_FEATURES,
  FREE_PLAN,
  PRO_FEATURES,
  PRO_PLAN,
  formatIDR,
} from "@/lib/billing/plans";
import { BRAND } from "@/lib/brand";
import { UpgradeButton } from "@/components/billing/UpgradeButton";

export const metadata: Metadata = {
  title: "Pricing — Splitzy",
  description: "Splitzy is free to use. Upgrade to Pro for unlimited AI receipt scans.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // Dark until launch: the page doesn't exist for users when the flag is OFF.
  if (!isEnabled("pricingPage")) notFound();

  const { status } = await searchParams;
  // Checkout is only truly live when the flag is ON and Xendit keys exist.
  const checkoutLive = isServerEnabled("xenditCheckout") && isXenditConfigured();

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 py-4 glass sticky top-0 z-50 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <Calculator className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">{BRAND.name}</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to home</span>
          </Link>
        </div>
      </header>

      <section className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-12">
          <p className="text-eyebrow uppercase text-muted-foreground mb-3">Pricing</p>
          <h1 className="text-display-2 mb-4">Simple, honest pricing</h1>
          <p className="text-lead text-muted-foreground max-w-xl mx-auto">
            Everything you need to split bills is free. Upgrade only if you want
            unlimited AI receipt scans.
          </p>
        </div>

        {status === "success" && (
          <div className="max-w-2xl mx-auto mb-8 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Payment received — your Pro benefits are now active. Thank you!
          </div>
        )}
        {status === "failed" && (
          <div className="max-w-2xl mx-auto mb-8 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Payment wasn&rsquo;t completed. No charge was made — feel free to try again.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border-2 border-border bg-card p-7 flex flex-col">
            <h2 className="text-heading">{FREE_PLAN.name}</h2>
            <div className="mt-3 mb-1 flex items-end gap-1">
              <span className="text-4xl font-extrabold">{formatIDR(FREE_PLAN.priceIDR)}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Free forever</p>
            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/single"
              className="w-full px-6 py-3 rounded-xl border-2 border-border text-foreground font-semibold text-center hover:bg-muted/50 transition-colors"
            >
              Start splitting
            </Link>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl border-2 border-primary bg-card p-7 flex flex-col shadow-premium-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-md">
              MOST POPULAR
            </div>
            <h2 className="text-heading">{PRO_PLAN.name}</h2>
            <div className="mt-3 mb-1 flex items-end gap-1.5">
              <span className="text-4xl font-extrabold">{formatIDR(PRO_PLAN.priceIDR)}</span>
              <span className="text-sm text-muted-foreground mb-1.5">
                / {PRO_PLAN.periodDays} days
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              One-time payment · renew whenever you like
            </p>
            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <UpgradeButton enabled={checkoutLive} priceLabel={formatIDR(PRO_PLAN.priceIDR)} />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Payments are processed securely by Xendit (GoPay, OVO, DANA, bank
          transfer, and cards). See our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
