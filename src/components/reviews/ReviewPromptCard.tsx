"use client";

import { Star } from "@/components/ui/icons";
import { useDictionary } from "@/lib/i18n/use-locale";
import { ReviewForm } from "./ReviewForm";

/**
 * Dashboard entry point. Persistent — unlike the post-split prompt this one
 * never dismisses, so someone who ignored the nudge can still come back to it.
 */
export function ReviewPromptCard() {
  const t = useDictionary().app.feedback;

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Star weight="fill" className="h-5 w-5 text-accent-strong" />
        </div>
        <div>
          <p className="font-semibold">{t.cardTitle}</p>
          <p className="text-sm text-muted-foreground">{t.cardSubtitle}</p>
        </div>
      </div>
      <ReviewForm source="dashboard" />
    </div>
  );
}
