"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import {
  ArrowRight,
  History,
  Layers,
  LogIn,
  Plane,
  Receipt,
  Sparkles,
} from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { BRAND } from "@/lib/brand";
import { isEnabled } from "@/lib/flags";
import { FREE_SCAN_LIMIT } from "@/lib/scan-quota";
import { Spinner } from "@/components/ui/spinner";
import { ReferralCard } from "@/components/referral/ReferralCard";

interface QuotaResponse {
  plan: string;
  isPro: boolean;
  remaining: number | null;
  resetAt: string | null;
}

const MODES = [
  { href: "/single", icon: Receipt, title: "Single Receipt", accent: "text-primary", bg: "from-primary/20 to-primary/5" },
  { href: "/multiple", icon: Layers, title: "Multiple Receipts", accent: "text-accent-strong", bg: "from-accent/20 to-accent/5" },
  { href: "/travel", icon: Plane, title: "Travel Spend", accent: "text-emerald-600 dark:text-emerald-400", bg: "from-emerald-500/20 to-emerald-500/5" },
];

export function DashboardClient() {
  const { dbUser, isAuthenticated, isLoading, signIn } = useAuth();
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const pricingLive = isEnabled("pricingPage");

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    fetch("/api/me/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) setQuota(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-50 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="md" />
            <span className="font-bold text-lg tracking-tight">{BRAND.name}</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/history" aria-label="Receipt history" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </Link>
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <section className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {!isLoading && !isAuthenticated ? (
          <div className="max-w-md mx-auto text-center py-16">
            <h1 className="text-heading mb-3">Sign in to see your dashboard</h1>
            <p className="text-muted-foreground mb-6">
              Your trips, receipts, and scan usage — all in one place.
            </p>
            <button
              onClick={() => signIn("/dashboard")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-eyebrow uppercase text-muted-foreground mb-2">Dashboard</p>
              <h1 className="text-display-2">
                {dbUser?.name ? `Welcome back, ${dbUser.name.split(" ")[0]}` : "Welcome back"}
              </h1>
            </div>

            {/* Quota widget */}
            <div className="mb-10 rounded-2xl border-2 border-border bg-card p-6">
              {quota?.isPro ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Pro plan</p>
                    <p className="text-sm text-muted-foreground">Unlimited AI receipt scans</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">AI scans this month</p>
                    <div className="text-sm text-muted-foreground">
                      {quota ? `${quota.remaining ?? 0} of ${FREE_SCAN_LIMIT} left` : <Spinner />}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: quota
                          ? `${Math.round(((quota.remaining ?? 0) / FREE_SCAN_LIMIT) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                  {pricingLive && (
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-primary hover:underline"
                    >
                      <Sparkles className="h-4 w-4" />
                      Upgrade to Pro for unlimited scans
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Referral */}
            <div className="mb-10">
              <ReferralCard />
            </div>

            {/* Quick actions */}
            <p className="text-eyebrow uppercase text-muted-foreground mb-4">Start something</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    className="group rounded-2xl border-2 border-transparent bg-card p-6 hover:shadow-premium-lg hover:border-border transition-all"
                  >
                    <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${m.bg} flex items-center justify-center mb-4`}>
                      <Icon className={`h-6 w-6 ${m.accent}`} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{m.title}</span>
                      <ArrowRight className={`h-4 w-4 ${m.accent} group-hover:translate-x-0.5 transition-transform`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
