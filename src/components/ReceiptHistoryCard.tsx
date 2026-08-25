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
    <div className="relative">
      <Link href={`/history/${id}`}>
      <Card className="hover:shadow-md transition-all hover:border-primary/30 cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-primary shrink-0" />
                <h3 className="font-semibold text-sm truncate">{title}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                      ? "text-amber-600 dark:text-amber-400"
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
            <div className="text-right shrink-0 flex items-center gap-2">
              <span className="font-bold text-sm">
                Rp {formatCurrency(totalAmount)}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
      </Link>

      {/* Outside the Link: a nested <a> would be invalid HTML and the whole
          card would swallow the click. */}
      <Button
        asChild
        size="sm"
        variant="secondary"
        className="absolute bottom-3 right-3 h-7 px-2 text-xs"
      >
        <Link href={resumeHref} aria-label={`Continue editing ${title}`}>
          <Edit2 className="h-3 w-3 mr-1" />
          Edit
        </Link>
      </Button>
    </div>
  );
}
