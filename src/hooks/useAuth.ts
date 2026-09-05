"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isPro: boolean;
  createdAt: string;
}

export interface AuthContextType {
  user: SupabaseUser | null;
  dbUser: DbUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (redirectTo?: string) => void;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  dbUser: null,
  isLoading: true,
  isAuthenticated: false,
  signIn: () => {},
  signOut: async () => {},
});

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchDbUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
      } else {
        setDbUser(null);
      }
    } catch {
      setDbUser(null);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      if (currentUser) {
        fetchDbUser();
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        fetchDbUser();
      } else {
        setDbUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, fetchDbUser]);

  const signIn = useCallback(
    (redirectTo?: string) => {
      const callbackUrl = new URL(
        "/api/auth/callback",
        window.location.origin
      );
      if (redirectTo) {
        callbackUrl.searchParams.set("next", redirectTo);
      }

      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });
    },
    [supabase.auth]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Clear app-specific localStorage so the next user on this device
    // does not inherit the previous session's drafts or guest counter.
    try {
      window.localStorage.removeItem("splitbill-single");
      window.localStorage.removeItem("splitbill-trips");
      window.localStorage.removeItem("splitzy-history");
      window.localStorage.removeItem("splitzy-guest-splits-count");
      // Travel Spend local-first caches (mirror/outbox/draft) are per-account or
      // ephemeral — don't let them leak to the next user on a shared device.
      window.localStorage.removeItem("splitzy-travel-mirror");
      window.localStorage.removeItem("splitzy-travel-outbox");
      window.localStorage.removeItem("splitzy-travel-draft");
    } catch {
      // localStorage may be unavailable — safe to ignore
    }
    setUser(null);
    setDbUser(null);
  }, [supabase.auth]);

  return {
    user,
    dbUser,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signOut,
  };
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
