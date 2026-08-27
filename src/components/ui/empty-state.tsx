import type { LucideIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

// Reusable empty-state (Sprint 5 design-system primitive): a centered icon +
// title + optional description and action. Replaces one-off "nothing here yet"
// markup so empty screens look intentional and consistent.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-4", className)}>
      <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
