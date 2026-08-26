"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "@/components/ui/icons";
import { capture } from "@/lib/analytics";

// Peak-end "moment" (Sprint 5): a small celebration when a Pro upgrade lands
// on /pricing?status=success. CSS-only (respects prefers-reduced-motion via the
// global rule); records a conversion event once on mount.
export function SuccessCelebration() {
  useEffect(() => {
    capture("pro_upgrade_success");
  }, []);

  return (
    <div className="flex flex-col items-center text-center py-8 animate-scale-in">
      <div className="relative mb-5">
        <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center animate-bounce-in">
          <CheckCircle2 className="h-11 w-11 text-success" />
        </div>
        {/* Decorative confetti dots */}
        {[
          "-top-1 -left-2 bg-primary",
          "-top-2 right-0 bg-accent",
          "top-1 -right-3 bg-emerald-500",
          "bottom-0 -left-3 bg-accent",
        ].map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`absolute h-2 w-2 rounded-full animate-bounce-in ${c}`}
            style={{ animationDelay: `${0.1 + i * 0.08}s` }}
          />
        ))}
      </div>
      <h2 className="text-heading">You&rsquo;re Pro! 🎉</h2>
      <p className="text-muted-foreground mt-1">
        Unlimited AI receipt scans are now unlocked. Thank you for the support!
      </p>
    </div>
  );
}
