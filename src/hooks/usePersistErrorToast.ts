"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import type { PersistError } from "@/hooks/useLocalStorage";

/**
 * Surface a failed localStorage write to the user.
 *
 * A quota/blocked-storage failure used to be a `console.warn` and nothing else:
 * the split kept working in memory, so everything looked fine, and the work
 * vanished on the next reload. The user's only actionable move is to export
 * before leaving, so say exactly that.
 *
 * Fires once per failure (keyed on the error's timestamp) so a rapid burst of
 * failing writes — every keystroke in the items table, for instance — does not
 * stack a wall of identical toasts.
 */
export function usePersistErrorToast(persistError: PersistError | null): void {
  const { toast } = useToast();
  const lastShownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!persistError) return;
    if (lastShownAtRef.current === persistError.at) return;
    lastShownAtRef.current = persistError.at;

    if (persistError.kind === "quota") {
      toast({
        title: "Storage full — changes aren't being saved",
        description:
          "Your browser ran out of space. Export this split now, then reset it or delete an old trip to free up room.",
        variant: "error",
        duration: 10000,
      });
    } else {
      toast({
        title: "This browser won't let us save",
        description:
          "Storage is blocked (private window, or site data turned off). Your split works right now but will be lost on reload — export it before you leave.",
        variant: "error",
        duration: 10000,
      });
    }
  }, [persistError, toast]);
}
