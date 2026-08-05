"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "@/components/ui/icons";
import { EVENTS, capture } from "@/lib/analytics";

// Client island for the pricing page. Kicks off checkout, then redirects the
// browser to the Xendit-hosted invoice. When checkout isn't live yet (flag off
// or keys not configured) it renders a disabled "Coming soon" button so the
// pricing page can still ship publicly.
export function UpgradeButton({
  enabled,
  priceLabel,
}: {
  enabled: boolean;
  priceLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    capture(EVENTS.upgradeClicked, { price_label: priceLabel });
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      // Not signed in → send them through Google sign-in, back to pricing.
      if (res.status === 401) {
        window.location.href = "/?login=required&redirect=/pricing";
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data?.invoiceUrl) {
        window.location.href = data.invoiceUrl as string;
        return;
      }
      setError(data?.error || "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        className="w-full px-6 py-3 rounded-xl bg-muted text-muted-foreground font-semibold cursor-not-allowed"
      >
        Coming soon
      </button>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={loading}
        className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Upgrade — {priceLabel}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-destructive text-center">{error}</p>}
    </div>
  );
}
