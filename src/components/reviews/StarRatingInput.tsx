"use client";

import { useId, useState } from "react";
import { Star } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type StarLabels = [string, string, string, string, string];

export interface StarRatingInputProps {
  /** 0 means nothing chosen yet. */
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Accessible group label, e.g. "How would you rate Splitzy?" */
  label: string;
  /** Per-star labels, 1★…5★. */
  starLabels: StarLabels;
  size?: "md" | "lg";
}

/**
 * Star rating as five native radio inputs.
 *
 * This is a form control, not decoration, so it is built on real radios rather
 * than `role="radiogroup"` over divs. Arrow-key roving focus, Home/End, and the
 * single-tab-stop group semantics then come from the browser instead of from
 * keyboard handlers we would have to write and keep correct, and a screen
 * reader announces "4 stars, radio button, 4 of 5" with no authored ARIA.
 *
 * The inputs are hidden with `sr-only` (a clip rect) and never `display:none`
 * or `hidden` — those would drop them out of the tab order and the a11y tree,
 * which is exactly the thing native radios were chosen for.
 */
export function StarRatingInput({
  value,
  onChange,
  disabled = false,
  label,
  starLabels,
  size = "md",
}: StarRatingInputProps) {
  const name = useId();
  // Pointer-only preview. It must never move `value` or focus — a hover is not
  // a choice, and stealing focus on mouseover breaks keyboard users mid-flow.
  const [hovered, setHovered] = useState<number | null>(null);
  const displayed = hovered ?? value;

  const starSize = size === "lg" ? "h-8 w-8" : "h-6 w-6";

  return (
    <fieldset
      className="border-0 p-0 m-0"
      onMouseLeave={() => setHovered(null)}
      disabled={disabled}
    >
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center gap-0.5">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <label
            key={n}
            className={cn(
              "group relative flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg touch-manipulation",
              disabled && "cursor-not-allowed opacity-60"
            )}
            onMouseEnter={() => !disabled && setHovered(n)}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              disabled={disabled}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <Star
              weight={n <= displayed ? "fill" : "regular"}
              aria-hidden="true"
              className={cn(
                starSize,
                "transition-transform",
                n <= displayed ? "text-accent-strong" : "text-muted-foreground/40",
                !disabled && "group-hover:scale-110",
                // The control is invisible, so the focus ring has to live on the
                // star instead — otherwise keyboard focus is simply not visible.
                "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:rounded"
              )}
            />
            <span className="sr-only">{starLabels[n - 1]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Read-only star row. Purely decorative, so the stars are hidden from the
 * a11y tree and a single visually-hidden span carries the meaning — five star
 * glyphs read out one by one is noise, not information.
 */
export function StarRatingDisplay({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <Star
          key={n}
          weight={n <= value ? "fill" : "regular"}
          aria-hidden="true"
          className={cn(
            "h-4 w-4",
            n <= value ? "text-accent-strong" : "text-muted-foreground/30"
          )}
        />
      ))}
      <span className="sr-only">{label}</span>
    </span>
  );
}
