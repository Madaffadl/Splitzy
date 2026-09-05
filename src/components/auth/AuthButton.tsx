"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User, Shield, LayoutDashboard } from "@/components/ui/icons";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export function AuthButton() {
  const { user, dbUser, isLoading, isAuthenticated, signIn, signOut } =
    useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      // Matches the resolved control's height so the header doesn't shift.
      <div className="h-11 w-11 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => signIn()}
        className="touch-manipulation min-w-[44px] gap-2"
        aria-label="Sign in with Google"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Sign In</span>
      </Button>
    );
  }

  const displayName = dbUser?.name ?? user.email ?? "User";
  const avatarUrl = dbUser?.avatarUrl ?? user.user_metadata?.avatar_url;
  // isProActive() on the server already returns false once proExpiresAt passes,
  // so an expired Pro drops the ring on the next /api/auth/me fetch.
  const isPro = dbUser?.isPro ?? false;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        aria-label={`Account menu — ${displayName}`}
        aria-expanded={showMenu}
        aria-haspopup="menu"
        className="touch-manipulation flex min-h-[44px] items-center gap-2 rounded-full border border-border/50 bg-background/80 px-2 py-1 hover:bg-muted transition-colors"
      >
        <span className={isPro ? "avatar-ring-pro" : undefined}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : (
            <span className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </span>
          )}
        </span>
        <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
          {displayName}
        </span>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-background shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium truncate">{displayName}</p>
              {isPro && (
                <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-accent-foreground">
                  PRO
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setShowMenu(false)}
            className="touch-manipulation w-full flex min-h-[44px] items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border"
          >
            <LayoutDashboard className="h-4 w-4 text-primary" />
            Dashboard
          </Link>
          {dbUser?.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setShowMenu(false)}
              className="touch-manipulation w-full flex min-h-[44px] items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border"
            >
              <Shield className="h-4 w-4 text-violet-500" />
              Admin dashboard
            </Link>
          )}
          <button
            onClick={async () => {
              setShowMenu(false);
              await signOut();
            }}
            className="touch-manipulation w-full flex min-h-[44px] items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
