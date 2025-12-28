"use client";

import { Receipt, Participant, PersonShare, SettlementTransfer } from "@/types";
import { getReceiptSummary, minimizeTransactions } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ArrowRight, Wallet, Calculator } from "lucide-react";
import { useState, useMemo } from "react";

interface SummaryPanelProps {
  receipt: Receipt;
  participants: Participant[];
  title?: string;
}

export function SummaryPanel({ receipt, participants, title }: SummaryPanelProps) {
  const [copied, setCopied] = useState(false);

  const participantIds = useMemo(
    () => participants.map((p) => p.id),
    [participants]
  );

  const summary = useMemo(
    () => getReceiptSummary(receipt, participantIds),
    [receipt, participantIds]
  );

  const settlements = useMemo(
    () => minimizeTransactions(summary.balances),
    [summary.balances]
  );

  const getParticipantName = (id: string) =>
    participants.find((p) => p.id === id)?.name || "Unknown";

  const generateExportText = () => {
    let text = `💰 ${title || receipt.title || "Bill Split"}\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    text += `📋 Subtotal: Rp ${formatCurrency(summary.receiptSubtotal)}\n`;
    text += `💵 Tax: Rp ${formatCurrency(receipt.tax)}\n`;
    text += `🍽️ Service: Rp ${formatCurrency(receipt.service)}\n`;
    text += `💳 Total: Rp ${formatCurrency(summary.grandTotal)}\n`;
    text += `👤 Paid by: ${getParticipantName(receipt.payerId)}\n\n`;
    text += `📊 Per Person:\n`;

    for (const share of summary.shares) {
      text += `• ${getParticipantName(share.participantId)}: Rp ${formatCurrency(share.total)}\n`;
    }

    if (settlements.length > 0) {
      text += `\n💸 Settlements:\n`;
      for (const s of settlements) {
        text += `• ${getParticipantName(s.from)} → ${getParticipantName(s.to)}: Rp ${formatCurrency(s.amount)}\n`;
      }
    } else {
      text += `\n✅ All settled!\n`;
    }

    return text;
  };

  const handleCopy = async () => {
    const text = generateExportText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (participantIds.length === 0 || !receipt.payerId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Add participants and select payer to see summary</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Summary
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" />
                Export
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Subtotal</div>
          <div className="text-right font-medium">
            Rp {formatCurrency(summary.receiptSubtotal)}
          </div>
          <div className="text-muted-foreground">Tax</div>
          <div className="text-right">Rp {formatCurrency(receipt.tax)}</div>
          <div className="text-muted-foreground">Service</div>
          <div className="text-right">Rp {formatCurrency(receipt.service)}</div>
          <div className="text-muted-foreground font-medium pt-2 border-t">
            Grand Total
          </div>
          <div className="text-right font-bold pt-2 border-t text-primary">
            Rp {formatCurrency(summary.grandTotal)}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Paid by:{" "}
          <Badge variant="secondary" className="ml-1">
            {getParticipantName(receipt.payerId)}
          </Badge>
        </div>

        {/* Per Person Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Per Person
          </h4>
          <div className="space-y-1">
            {summary.shares.map((share) => (
              <div
                key={share.participantId}
                className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md hover:bg-muted/50"
              >
                <span>{getParticipantName(share.participantId)}</span>
                <div className="flex flex-col items-end">
                  <span className="font-medium">
                    Rp {formatCurrency(share.total)}
                  </span>
                  {(share.taxAllocation > 0 || share.serviceAllocation > 0) && (
                    <span className="text-xs text-muted-foreground">
                      (Rp {formatCurrency(share.subtotal)} +{" "}
                      Rp {formatCurrency(share.taxAllocation + share.serviceAllocation)})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settlements */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Settlements
          </h4>
          {settlements.length === 0 ? (
            <div className="text-sm text-center py-2 text-emerald-600 bg-emerald-500/10 rounded-md">
              ✓ All settled!
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-2 px-3 rounded-md bg-muted/50"
                >
                  <span className="font-medium">
                    {getParticipantName(s.from)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getParticipantName(s.to)}</span>
                  <span className="ml-auto font-bold text-primary">
                    Rp {formatCurrency(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Trip summary component for multiple receipts
interface TripSummaryPanelProps {
  receipts: Receipt[];
  participants: Participant[];
  tripName: string;
}

export function TripSummaryPanel({
  receipts,
  participants,
  tripName,
}: TripSummaryPanelProps) {
  const [copied, setCopied] = useState(false);

  const participantIds = useMemo(
    () => participants.map((p) => p.id),
    [participants]
  );

  // Aggregate balances across all receipts
  const { aggregateBalances, totalGrandTotal } = useMemo(() => {
    const balances = new Map<string, number>();
    participantIds.forEach((id) => balances.set(id, 0));

    let total = 0;

    for (const receipt of receipts) {
      const summary = getReceiptSummary(receipt, participantIds);
      total += summary.grandTotal;

      for (const [id, balance] of summary.balances) {
        balances.set(id, (balances.get(id) || 0) + balance);
      }
    }

    // Round balances
    balances.forEach((v, k) => balances.set(k, Math.round(v * 100) / 100));

    return { aggregateBalances: balances, totalGrandTotal: Math.round(total * 100) / 100 };
  }, [receipts, participantIds]);

  const settlements = useMemo(
    () => minimizeTransactions(aggregateBalances),
    [aggregateBalances]
  );

  const getParticipantName = (id: string) =>
    participants.find((p) => p.id === id)?.name || "Unknown";

  const generateExportText = () => {
    let text = `🌴 ${tripName} - Trip Summary\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    text += `📋 ${receipts.length} receipt(s)\n`;
    text += `💳 Total: Rp ${formatCurrency(totalGrandTotal)}\n\n`;

    if (settlements.length > 0) {
      text += `💸 Final Settlements:\n`;
      for (const s of settlements) {
        text += `• ${getParticipantName(s.from)} → ${getParticipantName(s.to)}: Rp ${formatCurrency(s.amount)}\n`;
      }
    } else {
      text += `✅ Everyone is settled!\n`;
    }

    return text;
  };

  const handleCopy = async () => {
    const text = generateExportText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (receipts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Add receipts to see trip summary</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Trip Summary
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" />
                Export
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trip Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Receipts</div>
          <div className="text-right font-medium">{receipts.length}</div>
          <div className="text-muted-foreground font-medium pt-2 border-t">
            Trip Total
          </div>
          <div className="text-right font-bold pt-2 border-t text-primary">
            Rp {formatCurrency(totalGrandTotal)}
          </div>
        </div>

        {/* Balances */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Net Balances
          </h4>
          <div className="space-y-1">
            {Array.from(aggregateBalances.entries()).map(([id, balance]) => (
              <div
                key={id}
                className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md hover:bg-muted/50"
              >
                <span>{getParticipantName(id)}</span>
                <span
                  className={`font-medium ${
                    balance > 0
                      ? "text-emerald-600"
                      : balance < 0
                      ? "text-red-500"
                      : ""
                  }`}
                >
                  {balance > 0 ? "+" : ""}Rp {formatCurrency(balance)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Final Settlements */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Final Settlements
          </h4>
          {settlements.length === 0 ? (
            <div className="text-sm text-center py-2 text-emerald-600 bg-emerald-500/10 rounded-md">
              ✓ Everyone is settled!
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-2 px-3 rounded-md bg-muted/50"
                >
                  <span className="font-medium">
                    {getParticipantName(s.from)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getParticipantName(s.to)}</span>
                  <span className="ml-auto font-bold text-primary">
                    Rp {formatCurrency(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
