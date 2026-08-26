"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Receipt,
  ScanLine,
  Share2,
  Wallet,
  X,
} from "@/components/ui/icons";
import { capture } from "@/lib/analytics";

// First-run welcome (audit Sprint 4), behind NEXT_PUBLIC_FLAG_ONBOARDING.
// Shows once per browser (localStorage) and only on the landing route, so it
// never interrupts someone mid-split. Fully dark until the flag is enabled.
//
// Redesigned as a value showcase: each step pairs a benefit-led line with a
// small on-brand mock of the real UI, so first-run users *see* the payoff
// (who owes whom, minimal transfers) rather than reading a generic tour.
const STORAGE_KEY = "splitzy-onboarding-seen";

const STEPS = [
  {
    icon: Wallet,
    title: "Split bills without the awkward math",
    body: "Dining out or travelling? Splitzy works out who owes what — fair to the last rupiah.",
  },
  {
    icon: ScanLine,
    title: "Just snap the receipt",
    body: "AI reads the items, prices, tax and service. Tap to assign who shared each dish.",
  },
  {
    icon: Share2,
    title: "Settle in the fewest transfers",
    body: "Splitzy nets everything down to the minimum payments — ready to share to WhatsApp.",
  },
];

// Compact on-brand mock per step (mirrors the real Summary / scan / share UI).
function StepVisual({ step }: { step: number }) {
  if (step === 1) {
    return (
      <div className="rounded-xl border bg-background p-3.5 tabular-nums text-left" aria-hidden="true">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
          <ScanLine className="h-3.5 w-3.5 text-primary" /> Scanning receipt…
        </div>
        <div className="space-y-1.5">
          {[
            ["Nasi Goreng", "48.000"],
            ["Es Teh Manis", "18.000"],
            ["Ayam Bakar", "55.000"],
          ].map(([n, a]) => (
            <div key={n} className="flex justify-between text-xs rounded bg-muted/50 px-2.5 py-1.5">
              <span className="truncate">{n}</span>
              <span className="font-medium">Rp {a}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-success">
          <Check className="h-3.5 w-3.5" /> Items detected
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="rounded-xl border bg-background p-3.5 tabular-nums text-left" aria-hidden="true">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Settle up</p>
        <div className="space-y-1.5">
          {[
            ["Budi", "Alya", "44.000"],
            ["Citra", "Alya", "22.000"],
          ].map(([f, t, a]) => (
            <div key={`${f}${t}`} className="flex items-center gap-2 rounded-md bg-success/10 px-2.5 py-1.5 text-xs">
              <span className="font-medium">{f}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-medium">{t}</span>
              <span className="ml-auto font-bold text-success">Rp {a}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Share2 className="h-3 w-3" /> Share to WhatsApp
          </span>
        </div>
      </div>
    );
  }
  // step 0 — the payoff
  return (
    <div className="rounded-xl border-2 border-primary/20 bg-background p-3.5 tabular-nums text-left" aria-hidden="true">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Receipt className="h-3.5 w-3.5 text-primary" />
        </span>
        <span className="text-xs font-bold gradient-text">Summary · 4 people</span>
      </div>
      <div className="space-y-1">
        {[
          ["Alya", "142.000"],
          ["Budi", "98.000"],
          ["Citra", "120.000"],
        ].map(([n, a]) => (
          <div key={n} className="flex justify-between text-xs rounded bg-muted/50 px-2.5 py-1.5">
            <span className="font-medium">{n}</span>
            <span className="font-semibold text-primary">Rp {a}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Settled in just 2 transfers
      </div>
    </div>
  );
}

export function OnboardingModal() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (pathname !== "/") return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
        capture("onboarding_started");
      }
    } catch {
      // localStorage unavailable — skip onboarding silently.
    }
  }, [pathname]);

  function close(reason: "completed" | "skipped") {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    capture(reason === "completed" ? "onboarding_completed" : "onboarding_skipped", {
      step,
    });
    setOpen(false);
  }

  // Last step drives the primary action: start a real split instead of just
  // dismissing, so the tour converts into a first use.
  function finish() {
    close("completed");
    router.push("/single");
  }

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const { icon: Icon, title, body } = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-card border shadow-premium-lg p-6 sm:p-8">
        <button
          onClick={() => close("skipped")}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip onboarding"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Icon className="h-7 w-7 text-primary" />
        </div>

        <h2 className="text-heading text-center mb-2">{title}</h2>
        <p className="text-center text-muted-foreground mb-5">{body}</p>

        {/* Value showcase — a mini mock of the real UI for this step */}
        <div className="mb-6">
          <StepVisual step={step} />
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => close("skipped")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            {isLast ? "Split my first bill" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
