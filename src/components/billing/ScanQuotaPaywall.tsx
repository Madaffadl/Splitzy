"use client";

import Link from "next/link";
import { Sparkles } from "@/components/ui/icons";
import { isEnabled } from "@/lib/flags";
import { EVENTS, capture } from "@/lib/analytics";
import { FREE_SCAN_LIMIT } from "@/lib/scan-quota";

// Shown when a free user exhausts their monthly AI scans. When the pricing page
// is live it upsells Pro; otherwise it just reassures that scans reset — so this
// ships safely even while checkout is still dark.
export function ScanQuotaPaywall() {
  const pricingLive = isEnabled("pricingPage");

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
      <p className="text-sm font-medium text-foreground">
        You&rsquo;ve used all {FREE_SCAN_LIMIT} free AI scans this month.
      </p>
      {/* The wall stated the rule and stopped there. Adding the items by hand
          costs no quota and works right now — and the button for it is directly
          below this panel, so say so rather than leaving the user to guess
          whether their evening is over. */}
      <p className="mt-1 text-xs text-muted-foreground">
        You can still add this receipt&rsquo;s items by hand — no scan needed.
      </p>
      {pricingLive ? (
        <>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Upgrade to Pro for unlimited receipt scans.
          </p>
          <Link
            href="/pricing"
            onClick={() => capture(EVENTS.upgradeClicked, { source: "scan_paywall" })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-shadow"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </Link>
        </>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">
          Your free scans reset at the start of next month.
        </p>
      )}
    </div>
  );
}
