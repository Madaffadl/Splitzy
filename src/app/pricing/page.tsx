import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { isEnabled } from "@/lib/flags";
import {
  FREE_FEATURES,
  FREE_PLAN,
  formatIDR,
} from "@/lib/billing/plans";
import { BRAND } from "@/lib/brand";
import { ProCard } from "@/components/billing/ProCard";
import { SuccessCelebration } from "@/components/billing/SuccessCelebration";

export const metadata: Metadata = {
  // Absolute: the title already contains the brand, so skip the
  // "%s · Splitzy" template rather than shipping "… Splitzy · Splitzy".
  title: { absolute: "Splitzy Pricing — Free & Pro from Rp 14.900" },
  description:
    "Splitzy is free to split bills. Upgrade to Pro from Rp 14.900 for unlimited AI receipt scans and trip collaboration — a one-time payment, no auto-renew.",
  alternates: { canonical: "/pricing" },
};

// Objection-handling FAQ. All answers are accurate to the billing model in
// src/lib/billing/plans.ts (one-time purchase, no auto-renew).
const PRICING_FAQ = [
  {
    q: "Is Splitzy really free?",
    a: "Yes — splitting single bills, multiple receipts, and managing a solo trip is free forever. Pro unlocks unlimited AI scans, trip collaboration, and longer history.",
  },
  {
    q: "What happens when I run out of AI scans?",
    a: "You get 5 AI receipt scans per month on Free. When they run out you can still add items manually for free, and your scans reset at the start of the next month. Go Pro for unlimited scans.",
  },
  {
    q: "Which Pro plan should I pick?",
    a: "Trip Pass (10 hari, Rp 14.900) is perfect for a single holiday. Monthly (30 hari, Rp 29.000) suits frequent bill splitters. Annual (1 tahun, Rp 99.000) is the best value if you use Splitzy regularly.",
  },
  {
    q: "Is Pro a subscription?",
    a: "No. Pro is a one-time payment for a set period. It never auto-renews — you only pay again if and when you want to. No lock-in, no surprise charges.",
  },
  {
    q: "What payment methods can I use?",
    a: "Payments are handled securely by Xendit: GoPay, OVO, DANA, bank transfer, and cards.",
  },
  {
    q: "What if my payment fails?",
    a: "No charge is made unless the payment completes. If something goes wrong you can simply try again — you stay on Free in the meantime.",
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // Dark until launch: the page doesn't exist for users when the flag is OFF.
  if (!isEnabled("pricingPage")) notFound();

  const { status } = await searchParams;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 py-4 glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Logo size="md" />
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
          {/* The differentiator vs typical apps: no annual lock-in, no auto-renew */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-success">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            No subscription · No auto-renew · Pay only when you need it
          </div>
        </div>

        {status === "success" && (
          <div className="max-w-2xl mx-auto mb-8">
            <SuccessCelebration />
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

          {/* Pro — 3 duration options via client island */}
          <ProCard />
        </div>

        {/* FAQ — native <details>, no client JS */}
        <div className="max-w-2xl mx-auto mt-16">
          <h2 className="text-heading text-center mb-8">Pricing questions</h2>
          <div className="space-y-3">
            {PRICING_FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border bg-card px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold list-none">
                  {item.q}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-12">
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
