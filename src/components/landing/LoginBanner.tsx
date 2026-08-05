"use client";

import { useSearchParams } from "next/navigation";
import { LogIn } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";

// Small client island for the otherwise-RSC new landing: shows a "sign in"
// prompt when a protected route bounced the user here (?login=required).
export function LoginBanner() {
  const { isAuthenticated, signIn } = useAuth();
  const searchParams = useSearchParams();
  const loginRequired = searchParams.get("login") === "required";
  const redirectPath = searchParams.get("redirect") || "/multiple";

  if (!loginRequired || isAuthenticated) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          Sign in to view your Receipt History across devices.
        </p>
        <button
          onClick={() => signIn(redirectPath)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline whitespace-nowrap"
        >
          <LogIn className="h-4 w-4" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
