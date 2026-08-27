"use client";

import { ReactNode, useEffect, useRef } from "react";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  const prevAuthenticated = useRef(false);
  // True only on first render — used to skip the deauth toast on initial load
  // when the user simply isn't logged in yet.
  const hasResolvedOnce = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (auth.isLoading) return;

    // First auth resolution after mount — record state, do not toast.
    if (!hasResolvedOnce.current) {
      hasResolvedOnce.current = true;
      prevAuthenticated.current = auth.isAuthenticated;
      return;
    }

    // Signing in used to trigger a "migrate your local data?" dialog. That is
    // gone: saving a split is now an explicit action in the editor, which keeps
    // the local copy, covers Multiple as well as Single, and writes the shape
    // the resume flow reads. The migration did none of those — it deleted the
    // local copy after writing a payload the editor could not reopen.

    // Just logged out (manual signOut OR session expired): notify the user
    // so they understand why API calls might start failing.
    if (!auth.isAuthenticated && prevAuthenticated.current) {
      toast({
        title: "Signed out",
        description: "You have been signed out. Sign in again to access your data.",
        variant: "info",
      });
    }

    prevAuthenticated.current = auth.isAuthenticated;
  }, [auth.isAuthenticated, auth.isLoading, toast]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
