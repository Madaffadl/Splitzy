"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { SummaryPanel, MultipleReceiptSummaryPanel } from "@/components/SummaryPanel";
import { ArrowLeft, Loader2, AlertCircle } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Participant } from "@/types";
import type { ReceiptDetail } from "@/lib/data/types";
import { isMultipleSplit, receiptsFromDetail } from "@/lib/receipt-detail";

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/?login=required&redirect=/history/${id}`);
    }
  }, [authLoading, isAuthenticated, id, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    async function fetchDetail() {
      try {
        const res = await fetch(`/api/receipts/${id}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? "Receipt not found" : "Failed to load receipt"
          );
        }
        const data = await res.json();
        setDetail(data.receipt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    if (id) fetchDetail();
  }, [id, authLoading, isAuthenticated]);

  // Read through receiptsFromDetail, not the flat `detail.items/tax/service`
  // columns: those carry no `fees` and no `discounts`, so this page used to show
  // a Grand Total that disagreed with the one Continue opens for the same split.
  const receipts = useMemo(
    () => (detail ? receiptsFromDetail(detail) : []),
    [detail]
  );

  const participants: Participant[] = useMemo(() => {
    if (!detail) return [];
    return detail.participants;
  }, [detail]);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/history"
            aria-label="Back to history"
            className="touch-manipulation -ml-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium hidden sm:inline">
              Back to History
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow w-full">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Link
                href="/history"
                className="text-sm text-primary hover:underline"
              >
                Back to History
              </Link>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && detail && receipts.length > 0 && (
          <div className="space-y-4">
            {/* Title & meta */}
            <div>
              <h1 className="text-xl font-bold">{detail.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                {detail.tripName && (
                  <Badge variant="secondary">{detail.tripName}</Badge>
                )}
                {detail.date && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(detail.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* A saved "multiple" split has to render through the multi-receipt
                panel — the single panel only ever showed receipts[0], so the
                other receipts in the split were simply missing from the page.
                `savedSplitId` is passed so Share reuses this split's existing
                link instead of minting an orphan second one. */}
            {isMultipleSplit(detail) ? (
              <MultipleReceiptSummaryPanel
                receipts={receipts}
                participants={participants}
                splitName={detail.title}
                splitId={detail.id}
                savedSplitId={detail.id}
              />
            ) : (
              <SummaryPanel
                receipt={receipts[0]}
                participants={participants}
                title={detail.title}
                savedSplitId={detail.id}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
