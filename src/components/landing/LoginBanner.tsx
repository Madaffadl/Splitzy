"use client";

import { useSearchParams } from "next/navigation";
import { LogIn } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { useDictionary } from "@/lib/i18n/use-locale";

// Small client island for the otherwise-RSC new landing: shows a "sign in"
// prompt when a protected route bounced the user here (?login=required).
export function LoginBanner() {
  const t = useDictionary().app.loginRequired;
  const { isAuthenticated, signIn } = useAuth();
  const searchParams = useSearchParams();
  const loginRequired = searchParams.get("login") === "required";
  const redirectPath = searchParams.get("redirect") || "/multiple";

  if (!loginRequired || isAuthenticated) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        {/* Generic on purpose. This said "Sign in to view your Receipt History"
            for every caller, including UpgradeButton bouncing off /pricing — so
            it was already telling one of them the wrong thing. The redirect
            takes them where they were going; the banner only needs to explain
            why they are here. */}
        <p className="text-sm text-foreground">{t.body}</p>
        <button
          onClick={() => signIn(redirectPath)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline whitespace-nowrap"
        >
          <LogIn className="h-4 w-4" />
          {t.signIn}
        </button>
      </div>
    </div>
  );
}
