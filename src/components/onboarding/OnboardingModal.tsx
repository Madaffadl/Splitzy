"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Receipt, ScanLine, Share2, X } from "@/components/ui/icons";
import { isEnabled } from "@/lib/flags";
import { capture } from "@/lib/analytics";

// First-run welcome (audit Sprint 4), behind NEXT_PUBLIC_FLAG_ONBOARDING.
// Shows once per browser (localStorage) and only on the landing route, so it
// never interrupts someone mid-split. Fully dark until the flag is enabled.
const STORAGE_KEY = "splitzy-onboarding-seen";

const STEPS = [
  {
    icon: Receipt,
    title: "Welcome to Splitzy",
    body: "Split any bill fairly with friends — dining out or a whole trip — and see exactly who owes what.",
  },
  {
    icon: ScanLine,
    title: "Snap or type your items",
    body: "Scan a receipt with AI or add items by hand, then tap to assign who shared each one.",
  },
  {
    icon: Share2,
    title: "Settle up in seconds",
    body: "Splitzy minimizes the number of transfers, then you share the result straight to WhatsApp.",
  },
];

export function OnboardingModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isEnabled("onboarding") || pathname !== "/") return;
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

        <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Icon className="h-8 w-8 text-primary" />
        </div>

        <h2 className="text-heading text-center mb-2">{title}</h2>
        <p className="text-center text-muted-foreground mb-6">{body}</p>

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
            onClick={() => (isLast ? close("completed") : setStep((s) => s + 1))}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
          >
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
