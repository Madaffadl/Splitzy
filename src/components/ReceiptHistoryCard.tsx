"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, Calendar, Clock, Edit2, ArrowRight } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { daysUntilExpiry } from "@/lib/saved-splits";

interface ReceiptHistoryCardProps {
  id: string;
  title: string;
  date: string | null;
  totalAmount: number;
  itemCount: number;
  participantCount?: number;
  tripName: string | null;
  createdAt: string;
  /** When this saved split lapses. Null/absent = never (Travel receipts). */
  expiresAt?: string | null;
  /** "single" | "multiple" — which editor Edit should reopen it in. */
  type?: string;
}

export function ReceiptHistoryCard({
  id,
  title,
  date,
  totalAmount,
  itemCount,
  participantCount,
  tripName,
  createdAt,
  expiresAt,
  type,
}: ReceiptHistoryCardProps) {
  // Saved splits are deleted when they lapse, so the deadline is part of the
  // deal and has to be on screen. Silent deletion is what turns a feature into
  // a support ticket.
  const daysLeft = expiresAt ? daysUntilExpiry(expiresAt) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 2;
  const resumeHref = `/${type === "multiple" ? "multiple" : "single"}?resume=${id}`;
  const displayDate = date
    ? new Date(date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date(createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  return (
    // Two explicit actions in normal flow, rather than a whole-card link with a
    // small Edit button absolutely positioned in the corner. That version
    // overlapped the amount on a narrow screen, and its 28px height was under
    // the 44px touch minimum. It also made the primary action a guess: tap the
    // card to view, tap the corner to edit.
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Receipt className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="truncate text-sm font-semibold">{title}</h3>
            </div>
            {/* Wraps on a phone instead of overflowing — three metadata chips
                plus a date does not fit on one 360px line. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {displayDate}
              </span>
              <span>{itemCount} items</span>
              {participantCount ? <span>{participantCount} people</span> : null}
            </div>
            {daysLeft !== null && (
              <p
                className={
                  "mt-1.5 flex items-center gap-1 text-[11px] " +
                  (expiringSoon
                    ? "text-warning"
                    : "text-muted-foreground")
                }
              >
                <Clock className="h-3 w-3 shrink-0" />
                {daysLeft === 0
                  ? "Expires today"
                  : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
              </p>
            )}
            {tripName && (
              <Badge variant="secondary" className="mt-2 text-xs">
                {tripName}
              </Badge>
            )}
          </div>
          <span className="shrink-0 text-sm font-bold">
            Rp {formatCurrency(totalAmount)}
          </span>
        </div>

        <div className="mt-3 flex gap-2 border-t pt-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-[44px] flex-1 touch-manipulation sm:min-h-0"
          >
            <Link href={`/history/${id}`}>
              View
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="min-h-[44px] flex-1 touch-manipulation sm:min-h-0"
          >
            <Link href={resumeHref} aria-label={`Continue editing ${title}`}>
              <Edit2 className="mr-1 h-3.5 w-3.5" />
              Continue
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
