"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Loader2, Sparkles } from "@/components/ui/icons";
import { EVENTS, capture } from "@/lib/analytics";

export function UpgradeButton({
  priceLabel,
  planId,
}: {
  priceLabel: string;
  planId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    capture(EVENTS.upgradeClicked, { price_label: priceLabel, plan_id: planId });
    try {
      // Check auth before hitting the API — avoids a round-trip for guests and
      // gives us a clean redirect back to pricing after they sign in.
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const callbackUrl = new URL("/api/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("next", "/pricing");
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: callbackUrl.toString() },
        });
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planId ? { planId } : {}),
      });
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
