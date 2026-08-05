"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, Calendar, Users, ArrowRight } from "@/components/ui/icons";
import { formatCurrency } from "@/lib/utils";

interface ReceiptHistoryCardProps {
  id: string;
  title: string;
  date: string | null;
  totalAmount: number;
  itemCount: number;
  tripName: string | null;
  createdAt: string;
}

export function ReceiptHistoryCard({
  id,
  title,
  date,
  totalAmount,
  itemCount,
  tripName,
  createdAt,
}: ReceiptHistoryCardProps) {
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
              </div>
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
  );
}
