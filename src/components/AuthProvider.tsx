"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";
import { DataMigrationDialog } from "@/components/DataMigrationDialog";
import { localDataService } from "@/lib/data/local-data-service";
import { useToast } from "@/components/ui/toast";

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  const [showMigration, setShowMigration] = useState(false);
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

    // Just logged in: check if there's localStorage data to migrate.
    if (auth.isAuthenticated && !prevAuthenticated.current) {
      try {
        if (localDataService.hasLocalData()) {
          setShowMigration(true);
        }
      } catch {
        // localStorage may not be available
      }
    }

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

  return (
    <AuthContext.Provider value={auth}>
      {children}
      <DataMigrationDialog
        open={showMigration}
        onClose={() => setShowMigration(false)}
      />
    </AuthContext.Provider>
  );
}
