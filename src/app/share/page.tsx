"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, AlertCircle } from "@/components/ui/icons";
import { decodeShare, type SharePayload } from "@/lib/share";
import { SummaryPanel } from "@/components/SummaryPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Public read-only view for a shared split. The encoded payload is read from
 * `window.location.hash`, which never reaches the server — so this works for
 * unauthenticated viewers and doesn't leak data into request logs.
 */
export default function SharePage() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) {
      setError("This share link is empty.");
      setIsLoading(false);
      return;
    }
    const decoded = decodeShare(hash);
    if (!decoded) {
      setError("This share link is invalid or corrupted.");
      setIsLoading(false);
      return;
    }
    setPayload(decoded);
    setIsLoading(false);
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium hidden sm:inline">Splitzy home</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/25">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm sm:text-base">Shared split</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow w-full">
        {isLoading ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading shared split…
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-destructive/30">
            <CardContent className="py-12 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="font-semibold">{error}</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Ask whoever sent you this link to re-share, or start your own
                split.
              </p>
              <Link href="/single">
                <Button className="mt-2">Start a new split</Button>
              </Link>
            </CardContent>
          </Card>
        ) : payload ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">
                {payload.title || payload.receipt.title || "Shared split"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Read-only view. Anyone with this link can see the breakdown.
              </p>
            </div>
            <SummaryPanel
              receipt={payload.receipt}
              participants={payload.participants}
              title={payload.title || payload.receipt.title}
              readOnly
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
