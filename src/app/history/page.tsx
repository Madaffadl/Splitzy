"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { Button } from "@/components/ui/button";
import { ReceiptHistoryList } from "@/components/ReceiptHistoryList";
import { ArrowLeft, History, Loader2, LogIn } from "@/components/ui/icons";

export default function HistoryPage() {
  const { isAuthenticated, isLoading, signIn } = useAuth();

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            aria-label="Back to home"
            className="touch-manipulation -ml-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/25">
              <History className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base">Receipt History</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                Your past splits
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : !isAuthenticated ? (
          // Focused sign-in gate — keep the user on /history with a clear reason to
          // sign in, instead of bouncing them to the full marketing landing.
          <div className="flex flex-col items-center justify-center text-center py-16 sm:py-24">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5">
              <History className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-heading mb-2">See your receipt history</h1>
            <p className="text-muted-foreground max-w-sm mb-6">
              Sign in with Google to view your past splits and keep them synced across
              all your devices.
            </p>
            <Button onClick={() => signIn("/history")} size="lg" className="gap-2">
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Just want to split a bill?{" "}
              <Link href="/single" className="text-primary hover:underline">
                Start here
              </Link>
              .
            </p>
          </div>
        ) : (
          <ReceiptHistoryList />
        )}
      </div>
    </main>
  );
}
