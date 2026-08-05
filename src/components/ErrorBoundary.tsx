"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  // Custom fallback. Receives the caught error and a reset callback that
  // returns the boundary to its non-errored state (children re-render).
  fallback?: (error: Error, reset: () => void) => ReactNode;
  // Optional label shown in the default fallback so users know which area
  // failed (e.g. "split summary").
  label?: string;
  // Called when the boundary catches — useful for shipping to error
  // monitoring (Sentry etc.) without coupling the boundary to it.
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

// Section-level error boundary — wrap individual surfaces (SummaryPanel,
// ItemsTable, etc.) so a thrown calculation doesn't blank the whole page.
// Next.js' app/error.tsx is route-level and catches what escapes here.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface in dev console; production should route through onError.
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error);
    }
    this.props.onError?.(error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <p className="font-semibold text-foreground">
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {this.state.error.message || "Unexpected error"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.reset}
            className="mt-4"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
