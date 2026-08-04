"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Gift, Users } from "lucide-react";

interface ReferralData {
  code: string;
  referralUrl: string;
  rewardDays: number;
  totalReferrals: number;
  totalDaysEarned: number;
}

export function ReferralCard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/me/referral")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  async function copyLink() {
    if (!data?.referralUrl) return;
    await navigator.clipboard.writeText(data.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!data) return null;

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold">Invite Friends</p>
          <p className="text-sm text-muted-foreground">
            You earn {data.rewardDays} days Pro for every friend who joins
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-muted mb-3">
        <span className="flex-1 text-sm font-mono truncate text-foreground">
          {data.referralUrl}
        </span>
        <button
          onClick={copyLink}
          aria-label="Copy referral link"
          className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors shrink-0"
        >
          {copied ? (
            <><Check className="h-4 w-4" /> Copied!</>
          ) : (
            <><Copy className="h-4 w-4" /> Copy</>
          )}
        </button>
      </div>

      {data.totalReferrals > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {data.totalReferrals} friend{data.totalReferrals !== 1 ? "s" : ""} joined
            &nbsp;·&nbsp;{data.totalDaysEarned} days Pro earned
          </span>
        </div>
      )}
    </div>
  );
}
