"use client";

import { Receipt, Participant, PersonShareDetail } from "@/types";
import { getReceiptSummary, minimizeTransactions, getPersonShareDetails, getWalletStats } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ArrowRight, Wallet, Calculator, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { useState, useMemo } from "react";

interface SummaryPanelProps {
  receipt: Receipt;
  participants: Participant[];
  title?: string;
}

// Expandable person row component for audit view
function PersonBreakdown({
  detail,
  name,
  isPayer,
}: {
  detail: PersonShareDetail;
  name: string;
  isPayer: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border overflow-hidden">
      {/* Main row - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm py-2 px-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {isPayer && (
            <Badge variant="outline" className="text-xs py-0">
              Payer
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">
            Rp {formatCurrency(detail.total)}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-muted/30 border-t space-y-2 animate-fade-in">
          {/* Items list */}
          {detail.items.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" /> Items Consumed
              </p>
              {detail.items.map((item) => (
                <div
                  key={item.itemId}
                  className="flex justify-between text-xs py-1 px-2 rounded bg-background/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[120px]">{item.itemName}</span>
                    {item.sharedWith > 1 && (
                      <span className="text-muted-foreground">
                        (÷{item.sharedWith})
                      </span>
                    )}
                  </div>
                  <span className="font-medium">
                    Rp {formatCurrency(item.shareAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Subtotal */}
          <div className="flex justify-between text-xs pt-1 border-t">
            <span className="text-muted-foreground">Subtotal</span>
            <span>Rp {formatCurrency(detail.subtotal)}</span>
          </div>

          {/* Tax allocation */}
          {detail.taxAllocation > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">+ Tax share</span>
              <span>Rp {formatCurrency(detail.taxAllocation)}</span>
            </div>
          )}

          {/* Service allocation */}
          {detail.serviceAllocation > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">+ Service share</span>
              <span>Rp {formatCurrency(detail.serviceAllocation)}</span>
            </div>
          )}

          {/* Final total */}
          <div className="flex justify-between text-sm pt-1 border-t font-medium">
            <span>Total</span>
            <span className="text-primary">Rp {formatCurrency(detail.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
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

  const shareDetails = useMemo(
    () => getPersonShareDetails(receipt, participantIds),
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
    <Card className="sticky top-24 border-2 border-primary/20 shadow-premium-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <span className="gradient-text font-bold">Summary</span>
          </CardTitle>
          <Button
            variant="accent"
            size="sm"
            onClick={handleCopy}
            className="h-9"
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

        {/* Per Person Breakdown with Expandable Audit */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            Per Person
            <span className="text-xs font-normal">(tap to expand)</span>
          </h4>
          <div className="space-y-2">
            {shareDetails.map((detail) => (
              <PersonBreakdown
                key={detail.participantId}
                detail={detail}
                name={getParticipantName(detail.participantId)}
                isPayer={detail.participantId === receipt.payerId}
              />
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

  // Wallet stats (paid vs consumed)
  const walletStats = useMemo(() => {
    const stats = new Map<string, { paid: number; consumed: number }>();
    
    // Initialize
    for (const id of participantIds) {
      stats.set(id, { paid: 0, consumed: 0 });
    }
    
    // Calculate
    for (const receipt of receipts) {
      const summary = getReceiptSummary(receipt, participantIds);
      
      // Add to payer's paid total
      const payerStats = stats.get(receipt.payerId);
      if (payerStats) {
        payerStats.paid = Math.round((payerStats.paid + summary.grandTotal) * 100) / 100;
      }
      
      // Add to each person's consumed total
      for (const share of summary.shares) {
        const personStats = stats.get(share.participantId);
        if (personStats) {
          personStats.consumed = Math.round((personStats.consumed + share.total) * 100) / 100;
        }
      }
    }
    
    return stats;
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

        {/* Wallet Tracking */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            💰 Wallet Tracking
          </h4>
          <div className="space-y-2">
            {participantIds.map((id) => {
              const stat = walletStats.get(id);
              const paid = stat?.paid || 0;
              const consumed = stat?.consumed || 0;
              const net = Math.round((paid - consumed) * 100) / 100;
              
              return (
                <div
                  key={id}
                  className="p-3 rounded-lg border bg-card space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{getParticipantName(id)}</span>
                    <span
                      className={`text-sm font-semibold ${
                        net > 0
                          ? "text-emerald-600"
                          : net < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {net > 0 ? "+" : ""}Rp {formatCurrency(net)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-1.5 rounded bg-emerald-500/10">
                      <span className="text-emerald-700">Paid</span>
                      <span className="font-medium text-emerald-700">
                        Rp {formatCurrency(paid)}
                      </span>
                    </div>
                    <div className="flex justify-between p-1.5 rounded bg-orange-500/10">
                      <span className="text-orange-700">Consumed</span>
                      <span className="font-medium text-orange-700">
                        Rp {formatCurrency(consumed)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Net Balances (summarized) */}
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
