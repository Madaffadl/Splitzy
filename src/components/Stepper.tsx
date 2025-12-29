"use client";

import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";

export interface Step {
  id: string;
  title: string;
  icon?: React.ReactNode;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="w-full">
      {/* Progress Bar Background */}
      <div className="relative mb-4">
        <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-muted rounded-full" />
        <div 
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index <= currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center relative">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  "flex flex-col items-center gap-2 transition-all duration-300",
                  isClickable && "cursor-pointer hover:scale-105",
                  !isClickable && "cursor-default"
                )}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30",
                    isCurrent &&
                      "border-accent bg-accent text-accent-foreground shadow-lg shadow-accent/40 animate-pulse-glow",
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
                  
                  {/* Active indicator ring */}
                  {isCurrent && (
                    <div className="absolute -inset-1 rounded-full border-2 border-accent/30 animate-ping" />
                  )}
                </div>

                {/* Step Label */}
                <div
                  className={cn(
                    "flex flex-col items-center gap-0.5 transition-colors duration-300",
                    isCurrent && "text-foreground",
                    isCompleted && "text-primary",
                    !isCurrent && !isCompleted && "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-semibold text-center max-w-[80px]",
                      isCurrent && "text-sm"
                    )}
                  >
                    {step.title}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] text-accent font-medium">
                      Current
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
