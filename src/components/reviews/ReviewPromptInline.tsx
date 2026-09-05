"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useOwnReview } from "@/hooks/useOwnReview";
import { useDictionary } from "@/lib/i18n/use-locale";
import { ReviewForm } from "./ReviewForm";

const DISMISSED_KEY = "splitzy-review-prompt-dismissed";

/**
 * Post-split entry point: asked once, right after the user has seen a finished
 * split — the moment the product has actually proved useful.
 *
 * Every gate lives inside this component so the mount site stays a single line:
 *   - signed out → nothing, because POST /api/reviews is auth-only and a form
 *     that 401s on submit is a trap
 *   - already reviewed → nothing, never nag someone twice
 *   - dismissed once → nothing, ever again
 *
 * Pure client component, and the fetch only runs on mount. Nothing here touches
 * the server render, so /single stays statically prerendered.
 */
export function ReviewPromptInline() {
  const t = useDictionary().app.feedback;
  const { isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useLocalStorage<boolean>(DISMISSED_KEY, false);
  const { review, loaded, failed } = useOwnReview();

  if (!isAuthenticated || dismissed) return null;
  if (!loaded || failed) return null;
  // Only ever shown to someone who has not reviewed yet. The dashboard card is
  // where an existing review gets revisited.
  if (review) return null;

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-4">
          <Star weight="fill" className="h-5 w-5 shrink-0 text-accent-strong mt-0.5" />
          <div>
            <p className="font-semibold">{t.inlineTitle}</p>
            <p className="text-sm text-muted-foreground">{t.inlineSubtitle}</p>
          </div>
        </div>
        <ReviewForm
          source="summary"
          showBodyField={false}
          secondaryAction={
            <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
              {t.notNow}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
