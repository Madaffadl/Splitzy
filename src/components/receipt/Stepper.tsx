"use client";

import { cn } from "@/lib/utils";
import { Check, Sparkles } from "@/components/ui/icons";
import { fill, useDictionary } from "@/lib/i18n/use-locale";

export interface Step {
  id: string;
  /**
   * Dictionary key for this step's label, resolved here rather than passed in.
   *
   * Callers used to hand over a finished English string, which meant the label
   * could never be translated without every caller also becoming
   * locale-aware. `id` already identified the step; it now also names the copy.
   */
  labelKey: "participants" | "billDetails" | "summary";
  icon?: React.ReactNode;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  const t = useDictionary().app.stepper;
  const fillPercent =
    steps.length <= 1 ? 100 : (currentStep / (steps.length - 1)) * 100;

  // Each step owns an equal share of the width and centres inside it, instead of
  // the steps being pushed to the edges by `justify-between`. That was fine for
  // the circles and wrong for the labels: at 375px the last step's centred
  // 88px label overhung the container by about 20px, so "Summary" rendered as
  // "Summar" with the tail clipped — visible only once it was actually rendered
  // on a phone-width viewport.
  //
  // With equal shares the outer circles sit half a share in from each edge, so
  // the track spans from there to there. Derived from steps.length rather than
  // hardcoded, because this component takes an arbitrary number of steps.
  const halfShare = 100 / (steps.length * 2);
  const trackSpan = 100 - halfShare * 2;

  return (
    <nav aria-label={t.progressAria} className="w-full">
      <div className="relative">
        {/* Progress track — behind the circles, through their centres (top-6 = h-12 / 2) */}
        <div
          className="pointer-events-none absolute top-6 h-1 -translate-y-1/2 rounded-full bg-muted z-0"
          style={{ left: `${halfShare}%`, right: `${halfShare}%` }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-6 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500 z-0"
          style={{
            left: `${halfShare}%`,
            width: `calc(${trackSpan}% * ${fillPercent / 100})`,
          }}
          aria-hidden="true"
        />

        {/* Steps */}
        <div className="relative z-10 flex items-start">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isClickable = onStepClick && index <= currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "touch-manipulation flex min-w-0 flex-1 flex-col items-center gap-2 transition-transform duration-300",
                  isClickable && "cursor-pointer hover:scale-105",
                  !isClickable && "cursor-default"
                )}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors duration-300",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30",
                    isCurrent &&
                      "border-accent bg-accent text-accent-foreground shadow-lg shadow-accent/40",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : isCurrent ? (
                    <Sparkles className="h-5 w-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Step Label — fixed size to avoid layout shift on step change */}
                <span
                  className={cn(
                    "w-full px-1 text-center text-xs font-semibold leading-tight transition-colors duration-300",
                    !isCurrent && "hidden sm:inline-block",
                    isCurrent && "text-foreground",
                    isCompleted && "text-primary",
                    !isCurrent && !isCompleted && "text-muted-foreground"
                  )}
                >
                  <span className="sr-only">
                    {fill(t.srStepOf, { current: index + 1, total: steps.length })}
                    {isCompleted ? t.srCompleted : isCurrent ? t.srCurrent : ""}:{" "}
                  </span>
                  {t[step.labelKey]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
