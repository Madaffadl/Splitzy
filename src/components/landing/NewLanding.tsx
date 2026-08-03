import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Layers,
  Plane,
  Receipt,
  Sparkles,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { BRAND, copyrightYear } from "@/lib/brand";
import { LoginBanner } from "@/components/landing/LoginBanner";

// RSC landing (audit T-14), rendered behind the `newLanding` flag. Unlike the
// legacy client landing this is a Server Component: no scroll/parallax state,
// no client hooks except two small islands (AuthButton, ThemeToggle) and the
// LoginBanner. Server-rendered marketing = better TTFB and SEO. Static content
// streams immediately; interactivity hydrates in the islands only.

const MODES = [
  {
    href: "/single",
    icon: Receipt,
    title: "Single Receipt",
    body: "Split one dining bill or any shared expense with friends.",
    cta: "Start splitting",
    accent: "text-primary",
    ring: "hover:border-primary/30",
    iconBg: "from-primary/20 to-primary/5",
  },
  {
    href: "/multiple",
    icon: Layers,
    title: "Multiple Receipts",
    body: "Track several receipts with different payers and settle up together.",
    cta: "Start splitting",
    accent: "text-accent",
    ring: "hover:border-accent/30",
    iconBg: "from-accent/20 to-accent/5",
    badge: "POPULAR",
  },
  {
    href: "/travel",
    icon: Plane,
    title: "Travel Spend",
    body: "Log expenses across a whole trip and see who owes whom, anytime.",
    cta: "Start a trip",
    accent: "text-emerald-600 dark:text-emerald-400",
    ring: "hover:border-emerald-500/30",
    iconBg: "from-emerald-500/20 to-emerald-500/5",
    badge: "NEW",
  },
];

const STEPS = [
  { icon: Users, title: "Add participants", body: "Enter everyone who's splitting the bill." },
  { icon: Receipt, title: "Add items", body: "Scan the receipt with AI or add items manually." },
  { icon: CheckCircle2, title: "See results", body: "Get who pays what with minimal transactions." },
];

export function NewLanding() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-50 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg tracking-tight">{BRAND.name}</span>
              <span className="text-[10px] text-muted-foreground font-medium -mt-0.5 hidden sm:block">
                Split Bills Easily
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <LoginBanner />
      </Suspense>

      {/* Hero */}
      <section className="relative px-4 sm:px-6 py-16 sm:py-24 gradient-bg overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" aria-hidden="true" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/30 text-sm font-semibold text-foreground mb-8">
            <span className="w-2 h-2 rounded-full bg-accent" />
            Don&rsquo;t be the unpaid friend
          </div>
          <h1 className="text-display-1 mb-6">
            <span className="gradient-text bg-gradient-to-r from-primary via-accent to-primary">
              Split bills
            </span>{" "}
            with friends
          </h1>
          <p className="text-lead text-muted-foreground max-w-xl mx-auto mb-10">
            Dining out or traveling? Calculate who owes what with{" "}
            <span className="text-primary font-semibold">minimal transactions</span>.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/single"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              <Receipt className="h-5 w-5" />
              Split a bill
            </Link>
            <Link
              href="/travel"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border-2 border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 text-foreground font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Plane className="h-5 w-5 text-emerald-500" />
              Track a trip
            </Link>
          </div>
        </div>
      </section>

      {/* Mode cards */}
      <section className="px-4 sm:px-6 py-16 bg-background">
        <div className="max-w-5xl mx-auto grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`group relative overflow-hidden rounded-2xl border-2 border-transparent bg-card p-6 text-left transition-all duration-300 hover:shadow-premium-lg ${m.ring}`}
              >
                {m.badge && (
                  <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                    {m.badge}
                  </span>
                )}
                <div
                  className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${m.iconBg} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}
                >
                  <Icon className={`h-7 w-7 ${m.accent}`} />
                </div>
                <h2 className="text-xl font-bold mb-2">{m.title}</h2>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{m.body}</p>
                <div className={`flex items-center gap-2 text-sm font-semibold ${m.accent}`}>
                  <span>{m.cta}</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 sm:px-6 py-20 border-t bg-card">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">How it works</p>
            <h2 className="text-heading">Three simple steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative text-left">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/30">
                    {i + 1}
                  </div>
                  <div className="p-6 rounded-2xl bg-background border-2 border-transparent h-full">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 py-20 border-t bg-background">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            <Sparkles className="h-4 w-4" />
            Ready to settle the tab?
          </div>
          <h2 className="text-display-2 mb-6">
            Stop doing math. Start splitting{" "}
            <span className="gradient-text bg-gradient-to-r from-primary to-accent">fairly.</span>
          </h2>
          <p className="text-lead text-muted-foreground max-w-xl mx-auto mb-10">
            Free to use — sign in only to save your splits &amp; history.
          </p>
          <Link
            href="/single"
            className="inline-flex px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all items-center justify-center gap-2"
          >
            <Receipt className="h-5 w-5" />
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-8 border-t bg-card">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">{BRAND.name}</span>
              <span className="text-xs text-muted-foreground">{BRAND.tagline}</span>
            </div>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-foreground transition-colors">
              Support
            </a>
          </nav>
        </div>
        <p className="max-w-5xl mx-auto mt-5 text-center sm:text-left text-[11px] text-muted-foreground/70">
          © {copyrightYear()} {BRAND.name}. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
