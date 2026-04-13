"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";
import { DataMigrationDialog } from "@/components/DataMigrationDialog";
import { localDataService } from "@/lib/data/local-data-service";

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  const [showMigration, setShowMigration] = useState(false);
  const prevAuthenticated = useRef(false);

  // Detect first login and check for localStorage data
  useEffect(() => {
    if (
      !auth.isLoading &&
      auth.isAuthenticated &&
      !prevAuthenticated.current
    ) {
      // User just logged in
      try {
        if (localDataService.hasLocalData()) {
          setShowMigration(true);
        }
      } catch {
        // localStorage access may fail in SSR
      }
    }
    prevAuthenticated.current = auth.isAuthenticated;
  }, [auth.isAuthenticated, auth.isLoading]);

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
