import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Check,
  Crown,
  Globe,
  Layers,
  Lock,
  Plane,
  Receipt,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { BRAND, copyrightYear } from "@/lib/brand";
import { LoginBanner } from "@/components/landing/LoginBanner";
import {
  FREE_PLAN,
  PRO_PLAN,
  FREE_FEATURES,
  PRO_FEATURES,
  formatIDR,
} from "@/lib/billing/plans";

// RSC landing (audit T-14), rendered behind the `newLanding` flag. Server
// Component: no client hooks except the AuthButton/ThemeToggle/LoginBanner
// islands. Everything below — including the product mockups and the FAQ (native
// <details>) — is static markup so it streams immediately and needs no JS.
//
// Integrity note: Splitzy has no real usage counts or testimonials wired up, so
// this page never fabricates "10k users" / star ratings. Trust is built from
// honest product facts and by *showing the product* via on-brand UI mockups.

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
    accent: "text-accent-strong",
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
  {
    icon: Users,
    title: "Add participants",
    body: "Enter everyone who's splitting the bill.",
    wrap: "bg-primary/10",
    color: "text-primary",
  },
  {
    icon: ScanLine,
    title: "Scan or add items",
    body: "Snap the receipt — AI reads it — or type items in.",
    wrap: "bg-accent/15",
    color: "text-accent-strong",
  },
  {
    icon: CheckCircle2,
    title: "See who owes whom",
    body: "Get the fewest transfers needed to settle up.",
    wrap: "bg-emerald-500/15",
    color: "text-emerald-600 dark:text-emerald-400",
  },
];

// Honest trust facts — plain truths about how Splitzy works, never fabricated
// proof. These are the substitute for testimonials we don't have.
const PROOF = [
  {
    icon: Zap,
    title: "Start in seconds",
    body: "No account needed to split your first bills — just open and go.",
  },
  {
    icon: Lock,
    title: "Private by default",
    body: "Split as a guest and your data stays on your device. Sign in only to sync.",
  },
  {
    icon: ArrowRightLeft,
    title: "Math you can audit",
    body: "Every rupiah is traceable — expand any person to see exactly how their share was built.",
  },
  {
    icon: ShieldCheck,
    title: "Free forever core",
    body: "Splitting bills is free, always. Pro only adds unlimited AI scans.",
  },
];

const FAQ = [
  {
    q: "Is Splitzy really free?",
    a: "Yes. Splitting single bills, multiple receipts, and whole trips is free forever. Pro (Rp 29.000 / 30 days) only lifts the AI-scan limit — everything else stays free.",
  },
  {
    q: "Do I need an account?",
    a: "No. You can split your first bills as a guest with nothing to sign up for. Sign in with Google only when you want your receipt history synced across devices.",
  },
  {
    q: "Is my data safe?",
    a: "As a guest, your splits live on your own device. When you sign in, your history syncs to your account and is never sold or shared. See our Privacy Policy for details.",
  },
  {
    q: "How accurate is the split?",
    a: "Each item is divided only among the people who shared it, then tax, service, and discounts are scaled proportionally. You can expand any person to audit the exact breakdown.",
  },
  {
    q: "Can it handle different payers and currencies?",
    a: "Yes. Multiple Receipts supports different payers per receipt, and Travel Spend handles multi-currency trips with locked exchange rates and minimal-transfer settlement.",
  },
];

// ⚠️ PLACEHOLDER SOCIAL PROOF — these numbers and quotes are MOCK/illustrative
// only. There is no real usage-stats or testimonials source wired up (see
// src/lib/analytics.ts — write-only). REPLACE with verified figures/real quotes
// BEFORE shipping to production; showing fabricated proof to real visitors is
// misleading. Kept in these two arrays so the swap is a one-place edit.
const MOCK_STATS = [
  { value: "12,000+", label: "bills split" },
  { value: "Rp 4.2B+", label: "settled between friends" },
  { value: "30,000+", label: "transfers saved" },
  { value: "4.9★", label: "average rating" },
];

const MOCK_TESTIMONIALS = [
  {
    quote:
      "No more spreadsheet after every group dinner. I scan the receipt and everyone knows what they owe in seconds.",
    name: "Rani P.",
    role: "Jakarta",
    initial: "R",
  },
  {
    quote:
      "We used it for a 5-day Bali trip with 6 people and 3 currencies. It untangled everything into two transfers.",
    name: "Arif H.",
    role: "Bandung",
    initial: "A",
  },
  {
    quote:
      "Finally an app that doesn't force everyone to make an account first. I just send the split and people pay.",
    name: "Mega S.",
    role: "Surabaya",
    initial: "M",
  },
];

// A tiny on-brand mock of the real Summary panel — shows the *payoff* (who pays
// whom, minimal transfers) so visitors see the product, not just read about it.
function ProductPreview() {
  return (
    <div
      className="relative w-full max-w-sm mx-auto lg:mx-0"
      aria-hidden="true"
    >
      {/* soft brand glow behind the card */}
      <div className="absolute -inset-6 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-2xl rounded-full opacity-60" />
      <div className="relative rounded-2xl border-2 border-primary/20 bg-card shadow-premium-lg p-5 tabular-nums">
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-primary" />
            </span>
            <span className="font-bold gradient-text">Summary</span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">Dinner · 4 people</span>
        </div>

        {/* per-person */}
        <div className="space-y-1.5 mb-4">
          {[
            ["Alya", "142.000", true],
            ["Budi", "98.000", false],
            ["Citra", "120.000", false],
            ["Deni", "86.000", false],
          ].map(([name, amt, payer]) => (
            <div key={name as string} className="flex items-center justify-between rounded-md px-2.5 py-1.5 bg-muted/50 text-sm">
              <span className="flex items-center gap-2 font-medium">
                {name}
                {payer && (
                  <span className="rounded-full border border-primary/30 px-1.5 text-[9px] font-semibold text-primary">
                    Payer
                  </span>
                )}
              </span>
              <span className="font-semibold text-primary">Rp {amt}</span>
            </div>
          ))}
        </div>

        {/* settlements */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Settle up
        </p>
        <div className="space-y-1.5">
          {[
            ["Budi", "Alya", "44.000"],
            ["Citra", "Alya", "22.000"],
          ].map(([from, to, amt]) => (
            <div key={`${from}${to}`} className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-sm">
              <span className="font-medium">{from}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium">{to}</span>
              <span className="ml-auto font-bold text-emerald-600 dark:text-emerald-400">Rp {amt}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Settled in just 2 transfers
        </div>
      </div>
    </div>
  );
}

// One alternating feature row: copy on one side, an on-brand visual on the other.
function FeatureRow({
  eyebrow,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-eyebrow uppercase text-primary mb-3">{eyebrow}</p>
        <h3 className="text-heading mb-4">{title}</h3>
        <p className="text-lead text-muted-foreground mb-6">{body}</p>
        <ul className="space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-foreground/90">{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}

export function NewLanding() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-50 border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <Logo size="md" />
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg tracking-tight">{BRAND.name}</span>
              <span className="text-[10px] text-muted-foreground font-medium -mt-0.5 hidden sm:block">
                Split Bills Easily
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="#how" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </Link>
            <Link href="/pricing" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">
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

      {/* Hero — split layout: promise on the left, product on the right */}
      <section className="relative px-4 sm:px-6 py-16 sm:py-24 gradient-bg overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" aria-hidden="true" />
        <div className="hero-orb hero-orb-primary w-[420px] h-[420px] -top-32 -left-32 animate-float-slow" aria-hidden="true" />
        <div className="hero-orb hero-orb-accent w-[360px] h-[360px] -bottom-24 -right-16 animate-float-medium" aria-hidden="true" />

        <div className="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left: promise */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/30 text-sm font-semibold text-foreground mb-6">
              <span className="w-2 h-2 rounded-full bg-accent" />
              Don&rsquo;t be the unpaid friend
            </div>
            <h1 className="text-display-1 mb-5">
              <span className="gradient-text bg-gradient-to-r from-primary via-accent to-primary">
                Split the bill.
              </span>{" "}
              Settle in seconds.
            </h1>
            <p className="text-lead text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
              Dining out or travelling with friends? Scan the receipt, tap who had what, and
              Splitzy works out exactly who owes whom &mdash; in the{" "}
              <span className="text-primary font-semibold">fewest transfers possible</span>.
            </p>
            <div className="flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-3">
              <Link
                href="/single"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                <Receipt className="h-5 w-5" />
                Split a bill &mdash; free
              </Link>
              <Link
                href="/travel"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-foreground font-semibold hover:bg-foreground/5 transition-all flex items-center justify-center gap-2"
              >
                <Plane className="h-5 w-5 text-emerald-500" />
                Track a trip
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Free to start · No sign-up needed · Your data stays private
            </p>
          </div>

          {/* Right: product */}
          <ProductPreview />
        </div>
      </section>

      {/* Stats band — ⚠️ MOCK figures, replace before production (see MOCK_STATS) */}
      <section className="px-4 sm:px-6 py-12 bg-background border-b">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {MOCK_STATS.map((s) => (
            <div key={s.label}>
              <p className="text-3xl sm:text-4xl font-extrabold gradient-text tabular-nums">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem → solution */}
      <section className="px-4 sm:px-6 py-20 bg-background">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-eyebrow uppercase text-muted-foreground mb-3">The awkward part of going out</p>
          <h2 className="text-heading mb-5">
            &ldquo;Just send me whatever&rdquo; never actually works.
          </h2>
          <p className="text-lead text-muted-foreground">
            Someone always covers the bill. Then come the forgotten IOUs, the group-chat math,
            and the friend who quietly never pays. Splitzy makes the number exact and the
            payback obvious &mdash; so money never gets between friends.
          </p>
        </div>
      </section>

      {/* Feature showcase — alternating rows */}
      <section className="px-4 sm:px-6 py-20 border-t bg-card">
        <div className="max-w-5xl mx-auto space-y-24">
          <FeatureRow
            eyebrow="AI receipt scanning"
            title="Snap the receipt. Skip the typing."
            body="Point your camera at the receipt and Splitzy reads the items, prices, tax, and service for you."
            points={[
              "Works with photos or uploads",
              "Auto-detects tax, service & currency",
              "Edit anything before you split",
            ]}
            visual={
              <div className="relative rounded-2xl border bg-background p-5 shadow-premium tabular-nums" aria-hidden="true">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                  <ScanLine className="h-4 w-4 text-primary" /> Scanning receipt&hellip;
                </div>
                <div className="space-y-2">
                  {[
                    ["Nasi Goreng Spesial", "48.000"],
                    ["Es Teh Manis", "18.000"],
                    ["Ayam Bakar", "55.000"],
                    ["Service 5%", "6.050"],
                  ].map(([n, a]) => (
                    <div key={n} className="flex justify-between text-sm rounded bg-muted/50 px-3 py-2">
                      <span className="truncate">{n}</span>
                      <span className="font-medium">Rp {a}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" /> 4 items detected
                </div>
              </div>
            }
          />

          <FeatureRow
            flip
            eyebrow="Smart settlement"
            title="The fewest transfers, worked out for you."
            body="No more everyone-pays-everyone. Splitzy nets out the debts into the smallest set of transfers."
            points={[
              "Nets multiple receipts & payers together",
              "Mark transfers as paid to track settle-up",
              "Every amount is auditable, down to the item",
            ]}
            visual={
              <div className="relative rounded-2xl border bg-background p-5 shadow-premium tabular-nums" aria-hidden="true">
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="flex items-center gap-2 text-muted-foreground line-through">
                    <ArrowRightLeft className="h-4 w-4" /> 6 messy transfers
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <ArrowRight className="h-4 w-4" /> 2
                  </span>
                </div>
                <div className="space-y-1.5">
                  {[
                    ["Budi", "Alya", "44.000"],
                    ["Citra", "Alya", "22.000"],
                  ].map(([f, t, a]) => (
                    <div key={`${f}${t}`} className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm">
                      <span className="font-medium">{f}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{t}</span>
                      <span className="ml-auto font-bold text-emerald-600 dark:text-emerald-400">Rp {a}</span>
                    </div>
                  ))}
                </div>
              </div>
            }
          />

          <FeatureRow
            eyebrow="Travel Spend"
            title="A whole trip, one clear balance."
            body="Log every expense across a multi-day trip, in any currency, and always know who owes whom."
            points={[
              "Multi-currency with locked exchange rates",
              "Budget vs spent, per trip and per person",
              "Invite friends & share a read-only summary",
            ]}
            visual={
              <div className="relative rounded-2xl border bg-background p-5 shadow-premium tabular-nums" aria-hidden="true">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 font-semibold">
                    <Plane className="h-4 w-4 text-emerald-500" /> Bali Trip
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" /> IDR · SGD
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-semibold">Rp 3.240.000 <span className="text-muted-foreground font-normal">/ 4.000.000</span></span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: "81%" }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Rp 760.000 left in budget</p>
              </div>
            }
          />
        </div>
      </section>

      {/* How it works — connected timeline (a distinct rhythm from the mode-card
          grid below: colored step nodes joined by a line, not another card grid). */}
      <section id="how" className="px-4 sm:px-6 py-20 border-t bg-background scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">How it works</p>
            <h2 className="text-heading">Three simple steps</h2>
          </div>
          <div className="relative grid gap-10 md:grid-cols-3">
            {/* Connector line behind the nodes (desktop): spans node 1 → node 3. */}
            <div
              className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-primary/40 via-accent/40 to-emerald-500/40"
              aria-hidden="true"
            />
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative flex flex-col items-center text-center">
                  <div
                    className={`relative z-10 h-16 w-16 rounded-full ${s.wrap} ring-4 ring-background flex items-center justify-center mb-5`}
                  >
                    <Icon className={`h-7 w-7 ${s.color}`} />
                    <span className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center ring-2 ring-background">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[15rem]">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mode cards — pick your flow */}
      <section className="px-4 sm:px-6 py-16 border-t bg-card">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">Pick your flow</p>
            <h2 className="text-heading">One app, three ways to split</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`group relative overflow-hidden rounded-2xl border-2 border-transparent bg-background p-6 text-left transition-all duration-300 hover:shadow-premium-lg ${m.ring}`}
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
                  <h3 className="text-xl font-bold mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{m.body}</p>
                  <div className={`flex items-center gap-2 text-sm font-semibold ${m.accent}`}>
                    <span>{m.cta}</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why trust Splitzy — honest proof (no fabricated numbers/testimonials) */}
      <section className="px-4 sm:px-6 py-20 border-t bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">Why people trust it</p>
            <h2 className="text-heading">Built to be fair, private, and free</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PROOF.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-2xl border bg-card p-6">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-bold mb-1.5">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials — ⚠️ MOCK quotes, replace before production (see MOCK_TESTIMONIALS).
          Placed right before pricing so social proof leads into the subscribe CTA. */}
      <section className="px-4 sm:px-6 py-20 border-t bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">Loved by groups</p>
            <h2 className="text-heading">What people are saying</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {MOCK_TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-2xl border bg-card p-6 flex flex-col">
                <div className="text-accent-strong text-sm mb-3" aria-label="5 out of 5 stars">
                  ★★★★★
                </div>
                <blockquote className="text-sm text-foreground/90 leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
                    {t.initial}
                  </span>
                  <span className="text-sm">
                    <span className="font-semibold block leading-tight">{t.name}</span>
                    <span className="text-muted-foreground">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview — accurate, driven by the real plan constants */}
      <section className="px-4 sm:px-6 py-20 border-t bg-card">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">Simple, honest pricing</p>
            <h2 className="text-heading mb-3">Everything you need is free</h2>
            <p className="text-lead text-muted-foreground max-w-xl mx-auto">
              Upgrade only if you want unlimited AI receipt scans. No subscription trap &mdash; Pro
              is a one-time payment you renew whenever you like.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border-2 border-border bg-background p-6 flex flex-col">
              <h3 className="font-bold text-lg">{FREE_PLAN.name}</h3>
              <p className="mt-1 text-2xl font-extrabold">Free <span className="text-sm font-medium text-muted-foreground">forever</span></p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/single"
                className="mt-6 w-full px-5 py-3 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 text-foreground font-semibold text-center transition-all"
              >
                Start splitting
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border-2 border-primary/40 bg-background p-6 flex flex-col shadow-premium">
              <span className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">
                <Crown className="h-3 w-3" /> MOST POPULAR
              </span>
              <h3 className="font-bold text-lg">{PRO_PLAN.name}</h3>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">
                {formatIDR(PRO_PLAN.priceIDR)}
                <span className="text-sm font-medium text-muted-foreground"> / {PRO_PLAN.periodDays} days</span>
              </p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="mt-6 w-full px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-center shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 transition-all"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — native <details>, no JS, screen-reader friendly */}
      <section className="px-4 sm:px-6 py-20 border-t bg-background">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">Questions</p>
            <h2 className="text-heading">Everything you might be wondering</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
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
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 py-20 border-t bg-card">
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
            Free to use &mdash; sign in only to save your splits &amp; history.
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
            <Logo size="sm" />
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
