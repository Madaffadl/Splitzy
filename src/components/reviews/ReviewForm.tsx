"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useDictionary, useLocale, fill } from "@/lib/i18n/use-locale";
import type { ReviewSource } from "@/lib/validation";
import { useOwnReview, type OwnReview } from "@/hooks/useOwnReview";
import { StarRatingInput, StarRatingDisplay, type StarLabels } from "./StarRatingInput";

/** Five flat keys rather than an array — see the dictionary comment for why. */
function starLabelsOf(t: ReturnType<typeof useDictionary>["app"]["feedback"]): StarLabels {
  return [t.star1, t.star2, t.star3, t.star4, t.star5];
}

export interface ReviewFormProps {
  source: ReviewSource;
  /** Rendered under the stars; the inline variant hides it to stay compact. */
  showBodyField?: boolean;
  /** Extra action rendered beside Submit, e.g. the inline prompt's "Not now". */
  secondaryAction?: React.ReactNode;
  onSubmitted?: () => void;
}

/**
 * Rating + optional prose, with the four states a review can be in.
 * Shared by the dashboard card and the post-split prompt so the copy and the
 * submit path cannot drift between them.
 */
export function ReviewForm({
  source,
  showBodyField = true,
  secondaryAction,
  onSubmitted,
}: ReviewFormProps) {
  const t = useDictionary().app.feedback;
  const locale = useLocale();
  const { toast } = useToast();
  const { review, loaded, failed, submitting, submit } = useOwnReview();

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loaded) {
    return <div className="h-11 w-40 animate-pulse rounded-lg bg-muted" />;
  }
  // Only a genuinely failed fetch hides the form. "No review yet" is the
  // normal case and must still render.
  if (failed) return null;

  const startEditing = (existing: OwnReview) => {
    setRating(existing.rating);
    setBody(existing.body ?? "");
    setEditing(true);
    setError(null);
  };

  async function handleSubmit() {
    if (rating < 1) {
      setError(t.ratingRequired);
      return;
    }
    setError(null);
    const result = await submit({
      rating,
      body: body.trim() || null,
      source,
      locale,
    });
    if (result.ok) {
      setEditing(false);
      toast({ title: t.submitted, description: t.submittedBody, variant: "success" });
      onSubmitted?.();
    } else {
      toast({
        title: t.submitFailed,
        description: t.submitFailedBody,
        variant: "error",
      });
    }
  }

  // Already submitted, and not currently being edited → show status.
  if (review && !editing) {
    const statusLabel =
      review.status === "approved"
        ? t.statusApproved
        : review.status === "rejected"
          ? t.statusRejected
          : t.statusPending;

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StarRatingDisplay
            value={review.rating}
            label={starLabelsOf(t)[review.rating - 1]}
          />
          <span className="text-sm text-muted-foreground">{statusLabel}</span>
        </div>
        {review.body && (
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">
            {review.body}
          </p>
        )}
        {review.status === "rejected" && review.reviewNote && (
          <p className="text-sm text-muted-foreground">
            {fill(t.rejectedNote, { note: review.reviewNote })}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={() => startEditing(review)}>
          {t.edit}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StarRatingInput
        value={rating}
        onChange={(n) => {
          setRating(n);
          setError(null);
        }}
        label={t.ratingLabel}
        starLabels={starLabelsOf(t)}
        disabled={submitting}
        size={showBodyField ? "lg" : "md"}
      />

      {showBodyField && (
        <div className="space-y-1.5">
          <label htmlFor="review-body" className="text-sm font-medium">
            {t.bodyLabel}{" "}
            <span className="font-normal text-muted-foreground">
              ({t.bodyOptional})
            </span>
          </label>
          <Textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t.bodyPlaceholder}
            rows={3}
            maxLength={1000}
            disabled={submitting}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Editing an approved review sends it back to the queue — say so before
          they click, not after. */}
      {editing && review?.status === "approved" && (
        <p className="text-sm text-muted-foreground">{t.editWarning}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
        {editing && (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            disabled={submitting}
          >
            {t.cancel}
          </Button>
        )}
        {!editing && secondaryAction}
      </div>
    </div>
  );
}
