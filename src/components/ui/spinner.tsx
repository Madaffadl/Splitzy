import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared loading spinner (Sprint 5 design-system primitive). One place for
// loading affordance so screens stop hand-rolling their own.
export function Spinner({
  className,
  label = "Loading…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <Loader2 className={cn("h-4 w-4 animate-spin text-muted-foreground", className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// Full-height centered loading state for page/section bodies.
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Spinner className="h-6 w-6" label={label} />
    </div>
  );
}
