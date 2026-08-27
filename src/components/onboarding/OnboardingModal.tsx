"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Receipt,
  ScanLine,
  Share2,
  Wallet,
} from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";
import { fill, useDictionary } from "@/lib/i18n/use-locale";

// First-run welcome (audit Sprint 4). NOT behind a flag any more — onboarding
// graduated in Sprint 6 (see lib/flags.ts), so this is the first screen every
// new visitor sees. The stale "behind NEXT_PUBLIC_FLAG_ONBOARDING" note here is
// why its defects went unfixed for a while: it read as dark code.
// Shows once per browser (localStorage) and only on the landing route, so it
// never interrupts someone mid-split. Fully dark until the flag is enabled.
//
// Redesigned as a value showcase: each step pairs a benefit-led line with a
// small on-brand mock of the real UI, so first-run users *see* the payoff
// (who owes whom, minimal transfers) rather than reading a generic tour.
const STORAGE_KEY = "splitzy-onboarding-seen";

// Icons only. The copy used to live here as English literals, which meant the
// first screen a new user ever sees could not be translated — on a product whose
// market is Indonesia.
const STEP_ICONS = [Wallet, ScanLine, Share2] as const;

// Compact on-brand mock per step (mirrors the real Summary / scan / share UI).
function StepVisual({ step }: { step: number }) {
  const t = useDictionary().app.onboarding;
  if (step === 1) {
    return (
      <div className="rounded-xl border bg-background p-3.5 tabular-nums text-left" aria-hidden="true">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
          <ScanLine className="h-3.5 w-3.5 text-primary" /> {t.scanning}
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
          <Check className="h-3.5 w-3.5" /> {t.itemsDetected}
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="rounded-xl border bg-background p-3.5 tabular-nums text-left" aria-hidden="true">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t.settleUp}</p>
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
            <Share2 className="h-3 w-3" /> {t.shareWa}
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
        <span className="text-xs font-bold gradient-text">{t.summaryPeople}</span>
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
        <CheckCircle2 className="h-3.5 w-3.5" /> {t.settledIn}
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

  const t = useDictionary().app.onboarding;
  const isLast = step === STEP_ICONS.length - 1;
  const Icon = STEP_ICONS[step];
  const title = [t.t1, t.t2, t.t3][step];
  const body = [t.b1, t.b2, t.b3][step];

  return (
    // Radix, not a hand-rolled `fixed inset-0` div. The old one had no focus
    // trap, no Escape handler, no aria-modal and no scroll lock — on the very
    // first screen a new user sees, with a 20px close button as the only way
    // out. All of that comes free from the Dialog the rest of the app uses.
    <Dialog open={open} onOpenChange={(o) => !o && close("skipped")}>
      <DialogContent className="sm:max-w-md" aria-label={t.aria}>
        <DialogHeader>
          <div className="mx-auto mb-1 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{title}</DialogTitle>
          <DialogDescription className="text-center">{body}</DialogDescription>
        </DialogHeader>

        {/* Value showcase — a mini mock of the real UI for this step */}
        <StepVisual step={step} />

        {/* Progress. The dots were decorative only; the live region names the
            position so it is not carried by three 6px shapes alone. */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2" aria-hidden="true">
            {STEP_ICONS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {fill(t.stepOf, { current: step + 1, total: STEP_ICONS.length })}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Back was missing entirely: the tour could only be advanced or
              abandoned, so a misread step meant starting over. */}
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((n) => n - 1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.back}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => close("skipped")}>
              {t.skip}
            </Button>
          )}
          <Button onClick={() => (isLast ? finish() : setStep((n) => n + 1))}>
            {isLast ? t.finish : t.next}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
