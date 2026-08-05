"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  // Optional single action button (e.g. "Undo"). Running it dismisses the toast.
  action?: ToastAction;
}

interface ToastRecord extends Required<Omit<ToastOptions, "description" | "action">> {
  id: number;
  description?: string;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    // Soft-fail in non-provider contexts (e.g. unit tests) — no-op.
    return { toast: () => {} };
  }
  return ctx;
}

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = "info", duration = 3500, action }: ToastOptions) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, title, description, variant, duration, action }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        // bottom-24 keeps clear of the trip-mode sticky save bar (~76px tall) at all breakpoints
        className="pointer-events-none fixed bottom-24 right-4 z-[100] flex max-w-sm flex-col gap-2 sm:right-6"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const variantStyles: Record<
  ToastVariant,
  { bg: string; border: string; icon: React.ElementType; iconClass: string }
> = {
  success: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
  error: {
    bg: "bg-destructive/10",
    border: "border-destructive/40",
    icon: AlertTriangle,
    iconClass: "text-destructive",
  },
  info: {
    bg: "bg-primary/10",
    border: "border-primary/40",
    icon: Info,
    iconClass: "text-primary",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: () => void;
}) {
  const v = variantStyles[toast.variant];
  const Icon = v.icon;
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border p-3 pr-2 shadow-lg backdrop-blur-md animate-fade-in",
        "bg-background/95",
        v.border,
        v.bg
      )}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", v.iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
          className="shrink-0 self-center rounded-md border border-current/20 px-2 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
