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
  formatIDR,
} from "@/lib/billing/plans";
import {
  DEFAULT_LOCALE,
  HTML_LANG,
  localePath,
  type Locale,
} from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

// RSC landing (audit T-14) — the permanent landing since the newLanding flag
// was contracted in Sprint 6. Server Component: no client hooks except the
// AuthButton/ThemeToggle/LoginBanner islands. Everything below — including the
// product mockups and the FAQ (native <details>) — is static markup so it
// streams immediately and needs no JS.
//
// Bilingual (SEO Sprint 7): all copy comes from the locale dictionary rather
// than being hardcoded, so `/` renders Indonesian and `/en` renders English
// from this one component. Only *presentation* metadata (icons, gradients,
// hrefs) lives here now.
//
// Integrity note: the stats band and testimonials below are still placeholder
// figures — see MOCK_STATS / MOCK_TESTIMONIAL_STYLE. They are deliberately NOT
// emitted as aggregateRating/Review JSON-LD (see lib/seo/structured-data.ts).

// Presentation-only config for the three mode cards. Copy comes from the
// dictionary and is matched by index.
const MODE_STYLES = [
  {
    href: "/single",
    icon: Receipt,
    accent: "text-primary",
    ring: "hover:border-primary/30",
    iconBg: "from-primary/20 to-primary/5",
    badge: null as "popular" | "new" | null,
  },
  {
    href: "/multiple",
    icon: Layers,
    accent: "text-accent-strong",
    ring: "hover:border-accent/30",
    iconBg: "from-accent/20 to-accent/5",
    badge: "popular" as const,
  },
  {
    href: "/travel",
    icon: Plane,
    accent: "text-emerald-600 dark:text-emerald-400",
    ring: "hover:border-emerald-500/30",
    iconBg: "from-emerald-500/20 to-emerald-500/5",
    badge: "new" as const,
  },
];

const STEP_STYLES = [
  { icon: Users, wrap: "bg-primary/10", color: "text-primary" },
  { icon: ScanLine, wrap: "bg-accent/15", color: "text-accent-strong" },
  {
    icon: CheckCircle2,
    wrap: "bg-emerald-500/15",
    color: "text-emerald-600 dark:text-emerald-400",
  },
];

const PROOF_ICONS = [Zap, Lock, ArrowRightLeft, ShieldCheck];

// ⚠️ PLACEHOLDER SOCIAL PROOF — these numbers are MOCK/illustrative only. There
// is no real usage-stats source wired up (src/lib/analytics.ts is write-only).
// The owner has accepted keeping them live for now, but they MUST be replaced
// with real figures; if the metrics don't exist in the DB yet, they need to be
// added. Labels are translated via the dictionary; only the values live here so
// the swap stays a one-place edit.
const MOCK_STATS = ["12,000+", "Rp 4.2B+", "30,000+", "4.9★"];

// A tiny on-brand mock of the real Summary panel — shows the *payoff* (who pays
// whom, minimal transfers) so visitors see the product, not just read about it.
function ProductPreview({ dict }: { dict: Dictionary }) {
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
            <span className="font-bold gradient-text">{dict.preview.summary}</span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {dict.preview.context}
          </span>
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
                    {dict.preview.payer}
                  </span>
                )}
              </span>
              <span className="font-semibold text-primary">Rp {amt}</span>
            </div>
          ))}
        </div>

        {/* settlements */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          {dict.preview.settleUp}
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
          {dict.preview.settled}
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

export function NewLanding({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const dict = getDictionary(locale);
  const other: Locale = locale === "id" ? "en" : "id";

  // Bilingual routes need the locale prefix; the tool and legal routes are
  // single-URL for now and are linked as-is.
  const home = localePath(locale, "/");
  const about = localePath(locale, "/about");
  const faq = localePath(locale, "/faq");

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-50 border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href={home} className="flex items-center gap-2 sm:gap-3">
            <Logo size="md" />
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg tracking-tight">{BRAND.name}</span>
              <span className="text-[10px] text-muted-foreground font-medium -mt-0.5 hidden sm:block">
                {dict.header.tagline}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="#how" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">
              {dict.header.howItWorks}
            </Link>
            <Link href="/pricing" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">
              {dict.header.pricing}
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
              {dict.hero.badge}
            </div>
            <h1 className="text-display-1 mb-5">
              <span className="gradient-text bg-gradient-to-r from-primary via-accent to-primary">
                {dict.hero.titleAccent}
              </span>{" "}
              {dict.hero.titleRest}
            </h1>
            <p className="text-lead text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
              {dict.hero.leadBefore}
              <span className="text-primary font-semibold">{dict.hero.leadHighlight}</span>
              {dict.hero.leadAfter}
            </p>
            <div className="flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-3">
              <Link
                href="/single"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                <Receipt className="h-5 w-5" />
                {dict.hero.ctaPrimary}
              </Link>
              <Link
                href="/travel"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-foreground font-semibold hover:bg-foreground/5 transition-all flex items-center justify-center gap-2"
              >
                <Plane className="h-5 w-5 text-emerald-500" />
                {dict.hero.ctaSecondary}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">{dict.hero.note}</p>
          </div>

          {/* Right: product */}
          <ProductPreview dict={dict} />
        </div>
      </section>

      {/* Stats band — ⚠️ MOCK figures, replace with real data (see MOCK_STATS) */}
      <section className="px-4 sm:px-6 py-12 bg-background border-b">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {MOCK_STATS.map((value, i) => (
            <div key={dict.stats.labels[i]}>
              <p className="text-3xl sm:text-4xl font-extrabold gradient-text tabular-nums">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{dict.stats.labels[i]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem → solution */}
      <section className="px-4 sm:px-6 py-20 bg-background">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-eyebrow uppercase text-muted-foreground mb-3">{dict.problem.eyebrow}</p>
          <h2 className="text-heading mb-5">{dict.problem.heading}</h2>
          <p className="text-lead text-muted-foreground">{dict.problem.body}</p>
        </div>
      </section>

      {/* Feature showcase — alternating rows */}
      <section className="px-4 sm:px-6 py-20 border-t bg-card">
        <div className="max-w-5xl mx-auto space-y-24">
          <FeatureRow
            eyebrow={dict.features.scan.eyebrow}
            title={dict.features.scan.title}
            body={dict.features.scan.body}
            points={dict.features.scan.points}
            visual={
              <div className="relative rounded-2xl border bg-background p-5 shadow-premium tabular-nums" aria-hidden="true">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                  <ScanLine className="h-4 w-4 text-primary" /> {dict.featureVisuals.scanning}
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
                  <Check className="h-4 w-4" /> {dict.featureVisuals.itemsDetected}
                </div>
              </div>
            }
          />

          <FeatureRow
            flip
            eyebrow={dict.features.settle.eyebrow}
            title={dict.features.settle.title}
            body={dict.features.settle.body}
            points={dict.features.settle.points}
            visual={
              <div className="relative rounded-2xl border bg-background p-5 shadow-premium tabular-nums" aria-hidden="true">
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="flex items-center gap-2 text-muted-foreground line-through">
                    <ArrowRightLeft className="h-4 w-4" /> {dict.featureVisuals.messyTransfers}
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
            eyebrow={dict.features.travel.eyebrow}
            title={dict.features.travel.title}
            body={dict.features.travel.body}
            points={dict.features.travel.points}
            visual={
              <div className="relative rounded-2xl border bg-background p-5 shadow-premium tabular-nums" aria-hidden="true">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 font-semibold">
                    <Plane className="h-4 w-4 text-emerald-500" /> {dict.featureVisuals.tripName}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" /> IDR · SGD
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{dict.featureVisuals.spent}</span>
                  <span className="font-semibold">Rp 3.240.000 <span className="text-muted-foreground font-normal">/ 4.000.000</span></span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: "81%" }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{dict.featureVisuals.budgetLeft}</p>
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
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">{dict.steps.eyebrow}</p>
            <h2 className="text-heading">{dict.steps.heading}</h2>
          </div>
          <div className="relative grid gap-10 md:grid-cols-3">
            {/* Connector line behind the nodes (desktop): spans node 1 → node 3. */}
            <div
              className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-primary/40 via-accent/40 to-emerald-500/40"
              aria-hidden="true"
            />
            {dict.steps.items.map((s, i) => {
              const style = STEP_STYLES[i];
              const Icon = style.icon;
              return (
                <div key={s.title} className="relative flex flex-col items-center text-center">
                  <div
                    className={`relative z-10 h-16 w-16 rounded-full ${style.wrap} ring-4 ring-background flex items-center justify-center mb-5`}
                  >
                    <Icon className={`h-7 w-7 ${style.color}`} />
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
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">{dict.modes.eyebrow}</p>
            <h2 className="text-heading">{dict.modes.heading}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dict.modes.items.map((m, i) => {
              const style = MODE_STYLES[i];
              const Icon = style.icon;
              const badge =
                style.badge === "popular"
                  ? dict.modes.badgePopular
                  : style.badge === "new"
                    ? dict.modes.badgeNew
                    : null;
              return (
                <Link
                  key={style.href}
                  href={style.href}
                  className={`group relative overflow-hidden rounded-2xl border-2 border-transparent bg-background p-6 text-left transition-all duration-300 hover:shadow-premium-lg ${style.ring}`}
                >
                  {badge && (
                    <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                      {badge}
                    </span>
                  )}
                  <div
                    className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${style.iconBg} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}
                  >
                    <Icon className={`h-7 w-7 ${style.accent}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{m.body}</p>
                  <div className={`flex items-center gap-2 text-sm font-semibold ${style.accent}`}>
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
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">{dict.proof.eyebrow}</p>
            <h2 className="text-heading">{dict.proof.heading}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {dict.proof.items.map((p, i) => {
              const Icon = PROOF_ICONS[i];
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

      {/* Testimonials — ⚠️ MOCK quotes, must be replaced with real ones. Placed
          right before pricing so social proof leads into the subscribe CTA. */}
      <section className="px-4 sm:px-6 py-20 border-t bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">{dict.testimonials.eyebrow}</p>
            <h2 className="text-heading">{dict.testimonials.heading}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {dict.testimonials.items.map((t) => (
              <figure key={t.name} className="rounded-2xl border bg-card p-6 flex flex-col">
                <div className="text-accent-strong text-sm mb-3" aria-label={dict.testimonials.starLabel}>
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
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">{dict.pricing.eyebrow}</p>
            <h2 className="text-heading mb-3">{dict.pricing.heading}</h2>
            <p className="text-lead text-muted-foreground max-w-xl mx-auto">{dict.pricing.lead}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border-2 border-border bg-background p-6 flex flex-col">
              <h3 className="font-bold text-lg">{FREE_PLAN.name}</h3>
              <p className="mt-1 text-2xl font-extrabold">
                {dict.pricing.freePriceLabel}{" "}
                <span className="text-sm font-medium text-muted-foreground">
                  {dict.pricing.freePriceSuffix}
                </span>
              </p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {dict.pricing.freeFeatures.map((f) => (
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
                {dict.pricing.freeCta}
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border-2 border-primary/40 bg-background p-6 flex flex-col shadow-premium">
              <span className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">
                <Crown className="h-3 w-3" /> {dict.pricing.mostPopular}
              </span>
              <h3 className="font-bold text-lg">{PRO_PLAN.name}</h3>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">
                {formatIDR(PRO_PLAN.priceIDR)}
                <span className="text-sm font-medium text-muted-foreground">
                  {" "}
                  / {PRO_PLAN.periodDays} {dict.pricing.perDays}
                </span>
              </p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {dict.pricing.proFeatures.map((f) => (
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
                {dict.pricing.proCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — native <details>, no JS, screen-reader friendly. Mirrored as
          FAQPage JSON-LD by the page that renders this component. */}
      <section className="px-4 sm:px-6 py-20 border-t bg-background">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-eyebrow uppercase text-muted-foreground mb-3">{dict.faq.eyebrow}</p>
            <h2 className="text-heading">{dict.faq.heading}</h2>
          </div>
          <div className="space-y-3">
            {dict.faq.items.map((item) => (
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
          {/* Internal link into the long-form FAQ — gives the entity page a real
              entry point instead of relying on the sitemap alone. */}
          <p className="mt-8 text-center">
            <Link
              href={faq}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {dict.faq.seeAll}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 py-20 border-t bg-card">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            <Sparkles className="h-4 w-4" />
            {dict.finalCta.badge}
          </div>
          <h2 className="text-display-2 mb-6">
            {dict.finalCta.headingBefore}
            <span className="gradient-text bg-gradient-to-r from-primary to-accent">
              {dict.finalCta.headingAccent}
            </span>
          </h2>
          <p className="text-lead text-muted-foreground max-w-xl mx-auto mb-10">{dict.finalCta.lead}</p>
          <Link
            href="/single"
            className="inline-flex px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all items-center justify-center gap-2"
          >
            <Receipt className="h-5 w-5" />
            {dict.finalCta.cta}
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
            <Link href={about} className="hover:text-foreground transition-colors">{dict.nav.about}</Link>
            <Link href={faq} className="hover:text-foreground transition-colors">{dict.nav.faq}</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">{dict.nav.pricing}</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">{dict.nav.privacy}</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">{dict.nav.terms}</Link>
            <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-foreground transition-colors">
              {dict.nav.support}
            </a>
            {/* Language switcher — a crawlable <a> so Google discovers the
                alternate-language tree, not just a client-side toggle. */}
            <Link
              href={localePath(other, "/")}
              hrefLang={HTML_LANG[other]}
              lang={HTML_LANG[other]}
              className="font-semibold hover:text-foreground transition-colors"
            >
              {dict.switchTo}
            </Link>
          </nav>
        </div>
        <p className="max-w-5xl mx-auto mt-5 text-center sm:text-left text-[11px] text-muted-foreground/70">
          © {copyrightYear()} {BRAND.name}. {dict.footer.rights}
        </p>
      </footer>
    </main>
  );
}
