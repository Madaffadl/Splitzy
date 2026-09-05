"use client";

import { useState } from "react";
import { Check } from "@/components/ui/icons";
import { PRO_FEATURES, PRO_PLANS, formatIDR } from "@/lib/billing/plans";
import { UpgradeButton } from "./UpgradeButton";
import { cn } from "@/lib/utils";

export function ProCard() {
  const [selectedId, setSelectedId] = useState<string>(PRO_PLANS[1].id); // default: 30 hari

  const selected = PRO_PLANS.find((p) => p.id === selectedId) ?? PRO_PLANS[1];

  return (
    <div className="relative rounded-2xl border-2 border-primary bg-card p-7 flex flex-col shadow-premium-lg">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-md">
        UPGRADE TO PRO
      </div>

      <ul className="space-y-3 mb-6 flex-1">
        {PRO_FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* Duration selector */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {PRO_PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedId(plan.id)}
            className={cn(
              "relative flex flex-col items-center rounded-xl border-2 px-2 py-3 text-center transition-all",
              selectedId === plan.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            {plan.badge && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">
                {plan.badge.toUpperCase()}
              </span>
            )}
            <span className="text-[11px] font-semibold text-muted-foreground mb-1">
              {plan.label}
            </span>
            <span className="text-sm font-extrabold">{formatIDR(plan.priceIDR)}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {formatIDR(plan.perDayIDR)}/hari
            </span>
          </button>
        ))}
      </div>

      <UpgradeButton
        priceLabel={formatIDR(selected.priceIDR)}
        planId={selected.id}
      />
    </div>
  );
}
