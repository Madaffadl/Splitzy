"use client";

import { Receipt, Participant, PersonShareDetail, PaymentInfo } from "@/types";
import { getReceiptSummary, minimizeTransactions, getPersonShareDetails, getWalletStats, buildSettlementTrace } from "@/lib/calculations";
import { formatCurrency, cn } from "@/lib/utils";
import {
  formatPaymentInfoText,
  normalizePaymentInfo,
  hasPaymentInfo,
  PAYMENT_INFO_LIMITS,
} from "@/lib/payment-info";
import { formatDiscountValue, describeDiscountTarget } from "@/lib/discounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Check, ArrowRight, Wallet, Calculator, ChevronDown, ChevronUp, Eye, Share2, Loader2, Info, Landmark, Pencil, Plus, Tag, Target, Edit2, Trash2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { usePaidSettlements, settlementKey } from "@/hooks/usePaidSettlements";
import { useToast } from "@/components/ui/toast";

// Attribution + light promo appended to every copied summary. This is often
// the first time a non-user sees Splitzy (a friend gets billed, opens the
// message), so it doubles as brand awareness and a CTA back to the app.
function splitzyCopyFooter(origin: string): string {
  return `\n━━━━━━━━━━━━━━━\n✨ Split with Splitzy\n${origin}\n`;
}

interface SummaryPanelProps {
  receipt: Receipt;
  participants: Participant[];
  title?: string;
  // When true (public read-only views), hide the CSV/Share/Export actions and
  // drop the sidebar `sticky` so several panels can stack in a list.
  readOnly?: boolean;
  // When provided (editable contexts), each settlement recipient gets an
  // add/edit affordance for their bank/e-wallet details. Omitted in read-only
  // views, where payment info is shown but not editable.
  onUpdatePaymentInfo?: (participantId: string, info: PaymentInfo | undefined) => void;
}

// One recipient's payment details as a card row inside the "Rekening Tujuan"
// section. Shows the saved account (or a placeholder) and, in editable
// contexts (onSave provided), an add/edit dialog with a clear option.
function PaymentDestinationRow({
  participant,
  readOnly,
  onSave,
}: {
  participant: Participant;
  readOnly: boolean;
  onSave?: (info: PaymentInfo | undefined) => void;
}) {
  const info = participant.paymentInfo;
  const line = formatPaymentInfoText(info);
  const editable = !readOnly && !!onSave;

  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState(info?.bank ?? "");
  const [accountNumber, setAccountNumber] = useState(info?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(info?.accountName ?? "");

  const openDialog = () => {
    // Seed the form with the latest saved values each time it opens.
    setBank(info?.bank ?? "");
    setAccountNumber(info?.accountNumber ?? "");
    setAccountName(info?.accountName ?? "");
    setOpen(true);
  };

  const handleSave = () => {
    onSave?.(normalizePaymentInfo({ bank, accountNumber, accountName }));
    setOpen(false);
  };

  const handleClear = () => {
    onSave?.(undefined);
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div className="h-7 w-7 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
          <Landmark className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{participant.name}</p>
          {line ? (
            <p className="mt-0.5 text-xs text-muted-foreground break-all">{line}</p>
          ) : (
            <p className="mt-0.5 text-xs italic text-muted-foreground/70">
              No account added
            </p>
          )}
        </div>
      </div>
      {editable && (
        <Button
          type="button"
          variant={line ? "ghost" : "outline"}
          size="sm"
          onClick={openDialog}
          className="h-8 shrink-0"
        >
          {line ? (
            <>
              <Pencil className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Edit</span>
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Add</span>
            </>
          )}
        </Button>
      )}

      {editable && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment details</DialogTitle>
              <DialogDescription>
                Where to pay {participant.name} so others can transfer directly.
                All fields are optional.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Bank / E-Wallet</Label>
                <Input
                  value={bank}
                  maxLength={PAYMENT_INFO_LIMITS.bank}
                  onChange={(e) => setBank(e.target.value)}
                  placeholder="e.g. BCA, GoPay, OVO"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account Number</Label>
                <Input
                  value={accountNumber}
                  maxLength={PAYMENT_INFO_LIMITS.accountNumber}
                  inputMode="numeric"
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 1234567890"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account Holder Name</Label>
                <Input
                  value={accountName}
                  maxLength={PAYMENT_INFO_LIMITS.accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Alex Pratama"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              {hasPaymentInfo(info) && (
                <Button
                  variant="ghost"
                  onClick={handleClear}
                  className="text-destructive hover:text-destructive sm:mr-auto"
                >
                  Remove
                </Button>
              )}
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// "Rekening Tujuan" — one deduped row per unique settlement recipient, shown
// below the settlements list. Payment info belongs to the recipient (a person),
// not to each transfer, so rendering it once per person avoids the repetition
// of showing the same account on every "X → Y" line. In read-only views only
// recipients with saved details appear (section hides when none); in editable
// views every recipient is listed so each can be filled in.
export function PaymentDestinationsSection({
  recipientIds,
  participantsById,
  getParticipantName,
  readOnly,
  onUpdatePaymentInfo,
}: {
  recipientIds: string[];
  participantsById: Map<string, Participant>;
  getParticipantName: (id: string) => string;
  readOnly: boolean;
  onUpdatePaymentInfo?: (participantId: string, info: PaymentInfo | undefined) => void;
}) {
  const editable = !readOnly && !!onUpdatePaymentInfo;
  const recipients = recipientIds
    .map((id) => participantsById.get(id) ?? { id, name: getParticipantName(id) })
    .filter((p) => editable || hasPaymentInfo(p.paymentInfo));

  if (recipients.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Landmark className="h-4 w-4" />
        Payment Details
        {editable && <span className="text-xs font-normal">(where to pay)</span>}
      </h4>
      <div className="space-y-2">
        {recipients.map((p) => (
          <PaymentDestinationRow
            key={p.id}
            participant={p}
            readOnly={readOnly}
            onSave={
              onUpdatePaymentInfo
                ? (info) => onUpdatePaymentInfo(p.id, info)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
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
                    {item.qty > 1 && item.personQty > 0 ? (
                      <span className="text-muted-foreground">
                        ({item.personQty}×)
                      </span>
                    ) : item.sharedWith > 1 ? (
                      <span className="text-muted-foreground">
                        (÷{item.sharedWith})
                      </span>
                    ) : null}
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

          {/* Discount credit */}
          {detail.discount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
              <span>− Discount</span>
              <span>− Rp {formatCurrency(detail.discount)}</span>
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

// One receipt as an expandable row. Collapsed it shows the receipt title +
// total; expanded it reveals each person's per-item breakdown (the same
// PersonBreakdown used in the single-receipt view). Optional onEdit/onDelete
// render icon actions beside the toggle — used by the Travel Spend receipts list
// so receipt details live there instead of in the summary.
export function ReceiptBreakdown({
  receipt,
  participants,
  index,
  onEdit,
  onDelete,
}: {
  receipt: Receipt;
  participants: Participant[];
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

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
  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) map.set(p.id, p.name);
    return map;
  }, [participants]);
  const getParticipantName = (id: string) => participantNames.get(id) || "Unknown";

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 flex items-center justify-between text-sm py-2 px-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-primary/10 px-1 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <span className="font-medium truncate">{receipt.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold text-primary">
              Rp {formatCurrency(summary.amountPaid)}
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-0.5 pr-1 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${receipt.title}`}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${receipt.title}`}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-2 bg-muted/30 border-t space-y-2 animate-fade-in">
          <p className="text-xs text-muted-foreground">
            Paid by{" "}
            <span className="font-medium text-foreground">
              {getParticipantName(receipt.payerId)}
            </span>
          </p>
          {summary.totalDiscount > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Includes − Rp {formatCurrency(summary.totalDiscount)} discount
              (bill Rp {formatCurrency(summary.grandTotal)})
            </p>
          )}
          {shareDetails.map((detail) => (
            <PersonBreakdown
              key={detail.participantId}
              detail={detail}
              name={getParticipantName(detail.participantId)}
              isPayer={detail.participantId === receipt.payerId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SummaryPanel({ receipt, participants, title, readOnly = false, onUpdatePaymentInfo }: SummaryPanelProps) {
  const [copied, setCopied] = useState(false);
  // Short link is created lazily on first Share/Copy and cached for the session.
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const { toast } = useToast();

  // A share link is an immutable snapshot — if the receipt changes after one
  // was created, drop the cached link so the next Share/Copy mints a fresh one.
  useEffect(() => {
    setShareUrl(null);
  }, [receipt, participants, title]);

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

  // Unique recipients (settlement "to" side), in settlement order. Payment
  // details are shown once per recipient in the "Rekening Tujuan" section.
  const recipientIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const s of settlements) {
      if (!seen.has(s.to)) {
        seen.add(s.to);
        ids.push(s.to);
      }
    }
    return ids;
  }, [settlements]);

  const { isPaid, togglePaid } = usePaidSettlements(`receipt:${receipt.id}`);

  // Memoized name lookup — settlements + per-person breakdown can call this
  // many times; the previous .find() was O(n) per call, this is O(1).
  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) map.set(p.id, p.name);
    return map;
  }, [participants]);
  const getParticipantName = (id: string) => participantNames.get(id) || "Unknown";

  const participantsById = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const p of participants) map.set(p.id, p);
    return map;
  }, [participants]);

  // Deduped "Rekening tujuan" block for the copy text (one line per recipient),
  // mirroring the on-screen section. Empty string when no recipient has details.
  const formatPaymentDestinations = (ids: string[]): string => {
    const lines = ids
      .map((id) => ({
        name: getParticipantName(id),
        line: formatPaymentInfoText(participantsById.get(id)?.paymentInfo),
      }))
      .filter((d) => d.line);
    if (lines.length === 0) return "";
    return `\n🏦 Payment details:\n` + lines.map((d) => `• ${d.name}: ${d.line}\n`).join("");
  };

  const generateExportText = () => {
    let text = `💰 ${title || receipt.title || "Bill Split"}\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    text += `📋 Subtotal: Rp ${formatCurrency(summary.receiptSubtotal)}\n`;
    text += `💵 Tax: Rp ${formatCurrency(receipt.tax)}\n`;
    text += `🍽️ Service: Rp ${formatCurrency(receipt.service)}\n`;
    text += `💳 Total: Rp ${formatCurrency(summary.grandTotal)}\n`;
    if (summary.totalDiscount > 0) {
      text += `🏷️ Discount: -Rp ${formatCurrency(summary.totalDiscount)}\n`;
      text += `✅ Amount to pay: Rp ${formatCurrency(summary.amountPaid)}\n`;
    }
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
      text += formatPaymentDestinations(recipientIds);
    } else {
      text += `\n✅ All settled!\n`;
    }

    return text;
  };

  // Create the short link once, then reuse it. Returns null on failure (a toast
  // is shown), so callers can still proceed (e.g. copy the text without a link).
  const ensureShareUrl = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl;
    setCreatingLink(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "single",
          title: title || receipt.title || "Bill Split",
          participants,
          receipts: [receipt],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Request failed");
      }
      const { code } = await res.json();
      const url = `${window.location.origin}/s/${code}`;
      setShareUrl(url);
      return url;
    } catch (err) {
      toast({
        title: "Couldn't create share link",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
      return null;
    } finally {
      setCreatingLink(false);
    }
  };

  const handleShareLink = async () => {
    const url = await ensureShareUrl();
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({ title: title || receipt.title || "Splitzy", url });
        return;
      } catch {
        // User cancelled or share failed → fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Read-only view, valid for 14 days.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Couldn't copy link",
        description: "Please copy it manually.",
        variant: "error",
      });
    }
  };

  // "Copy" copies the human-readable summary with the short link appended, so a
  // WhatsApp message shows the split inline and links out to the full detail.
  const handleCopy = async () => {
    const url = await ensureShareUrl();
    let text = generateExportText();
    if (url) text += `\n🔗 View full breakdown:\n${url}\n`;
    text += splitzyCopyFooter(window.location.origin);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Please try again.",
        variant: "error",
      });
    }
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
    <Card className={cn("border-2 border-primary/20 shadow-premium-lg", !readOnly && "sticky top-24")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <span className="gradient-text font-bold">Summary</span>
          </CardTitle>
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareLink}
                disabled={creatingLink}
                className="h-9 px-2 sm:px-3"
                aria-label="Create and share a read-only link"
              >
                {creatingLink ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden md:inline ml-1.5">Share</span>
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleCopy}
                disabled={creatingLink}
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
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
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
          <div className={cn("text-right pt-2 border-t", summary.totalDiscount > 0 ? "font-medium" : "font-bold text-primary")}>
            Rp {formatCurrency(summary.grandTotal)}
          </div>
          {summary.totalDiscount > 0 && (
            <>
              <div className="text-emerald-600 dark:text-emerald-400">Discount</div>
              <div className="text-right text-emerald-600 dark:text-emerald-400">
                − Rp {formatCurrency(summary.totalDiscount)}
              </div>
              <div className="text-muted-foreground font-medium pt-2 border-t">
                Amount to Pay
              </div>
              <div className="text-right font-bold pt-2 border-t text-primary">
                Rp {formatCurrency(summary.amountPaid)}
              </div>
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Paid by:{" "}
          <Badge variant="secondary" className="ml-1">
            {getParticipantName(receipt.payerId)}
          </Badge>
        </div>

        {/* Applied discounts */}
        {receipt.discounts && receipt.discounts.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Discounts
            </h4>
            <div className="space-y-1">
              {receipt.discounts.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">
                    {d.label || describeDiscountTarget(d, receipt.items, participants)}
                    <span className="ml-1 text-muted-foreground/60">
                      · {d.scope === "receipt" ? "bill" : d.scope === "item" ? "item" : "person"}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">
                    − {formatDiscountValue(d)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
            <div className="text-sm text-center py-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md">
              ✓ All settled!
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s) => {
                const key = settlementKey(s);
                const paid = isPaid(key);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => togglePaid(key)}
                    aria-pressed={paid}
                    aria-label={`${paid ? "Mark unpaid" : "Mark paid"}: ${getParticipantName(s.from)} pays ${getParticipantName(s.to)} Rp ${formatCurrency(s.amount)}`}
                    className={cn(
                      "group w-full flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm py-2 px-3 rounded-md text-left transition-colors",
                      paid
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                        : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          paid
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-muted-foreground/40 group-hover:border-primary"
                        )}
                        aria-hidden="true"
                      >
                        {paid && <Check className="h-3 w-3" />}
                      </span>
                      <span className={cn("font-medium truncate max-w-[80px] sm:max-w-none", paid && "line-through text-muted-foreground")}>
                        {getParticipantName(s.from)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={cn("font-medium truncate max-w-[80px] sm:max-w-none", paid && "line-through text-muted-foreground")}>
                        {getParticipantName(s.to)}
                      </span>
                    </div>
                    <span className={cn("font-bold sm:ml-auto", paid ? "text-emerald-600 dark:text-emerald-400" : "text-primary")}>
                      Rp {formatCurrency(s.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment destinations — one row per unique recipient (deduped). */}
        <PaymentDestinationsSection
          recipientIds={recipientIds}
          participantsById={participantsById}
          getParticipantName={getParticipantName}
          readOnly={readOnly}
          onUpdatePaymentInfo={onUpdatePaymentInfo}
        />
      </CardContent>
    </Card>
  );
}

// Summary component for a Multiple Receipts split (several receipts settled
// together across the same people).
interface MultipleReceiptSummaryPanelProps {
  receipts: Receipt[];
  participants: Participant[];
  splitName: string;
  splitId?: string;
  // Optional spending target (Travel Spend). When set, a Budget vs Spent
  // progress block is shown.
  budget?: number;
  // When false, the per-receipt "Receipt Details" section is hidden (Travel
  // Spend shows those details in its Receipts list instead, to keep the
  // summary compact). Defaults to true.
  showReceiptDetails?: boolean;
  // Compact mode (Travel Spend overview sidebar): show only Total, Budget, and
  // per-person net — the full breakdown lives on the dedicated summary view.
  compact?: boolean;
  // When true (the public /s/<code> view), hide the Share/Copy actions — the
  // viewer is already looking at the shared snapshot and can't edit it.
  readOnly?: boolean;
  // Editable contexts pass this to let each settlement recipient add/edit their
  // bank/e-wallet details. Omitted in the read-only shared view.
  onUpdatePaymentInfo?: (participantId: string, info: PaymentInfo | undefined) => void;
}

export function MultipleReceiptSummaryPanel({
  receipts,
  participants,
  splitName,
  splitId,
  budget,
  showReceiptDetails = true,
  compact = false,
  readOnly = false,
  onUpdatePaymentInfo,
}: MultipleReceiptSummaryPanelProps) {
  const [copied, setCopied] = useState(false);
  // Short link is created lazily on first Share/Copy and cached for the session
  // so repeated clicks reuse the same link instead of minting a new row.
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const { toast } = useToast();
  // Track which wallet card is expanded (one toggle per person)
  const [openWallet, setOpenWallet] = useState<Record<string, boolean>>({});
  const toggleWallet = (id: string) =>
    setOpenWallet((prev) => ({ ...prev, [id]: !prev[id] }));

  // A share link is an immutable snapshot — if the split changes after one was
  // created, drop the cached link so the next Share/Copy mints a fresh one.
  useEffect(() => {
    setShareUrl(null);
  }, [receipts, participants, splitName]);

  const participantIds = useMemo(
    () => participants.map((p) => p.id),
    [participants]
  );

  // Aggregate balances across all receipts
  const { aggregateBalances, totalGrandTotal, totalDiscount, totalPaid } = useMemo(() => {
    const balances = new Map<string, number>();
    participantIds.forEach((id) => balances.set(id, 0));

    let total = 0;
    let discount = 0;
    let paid = 0;

    for (const receipt of receipts) {
      const summary = getReceiptSummary(receipt, participantIds);
      total += summary.grandTotal;
      discount += summary.totalDiscount;
      paid += summary.amountPaid;

      for (const [id, balance] of summary.balances) {
        balances.set(id, (balances.get(id) || 0) + balance);
      }
    }

    // Round balances
    balances.forEach((v, k) => balances.set(k, Math.round(v * 100) / 100));

    return {
      aggregateBalances: balances,
      totalGrandTotal: Math.round(total * 100) / 100,
      totalDiscount: Math.round(discount * 100) / 100,
      totalPaid: Math.round(paid * 100) / 100,
    };
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
      
      // Add to payer's paid total — the actual cash fronted after discounts.
      const payerStats = stats.get(receipt.payerId);
      if (payerStats) {
        payerStats.paid = Math.round((payerStats.paid + summary.amountPaid) * 100) / 100;
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

  // Per-person breakdown: which receipts they paid, which items they consumed
  const walletBreakdowns = useMemo(() => {
    type PaidEntry = { receiptTitle: string; amount: number };
    type ConsumedItem = { name: string; amount: number };
    type ConsumedEntry = { receiptTitle: string; amount: number; items: ConsumedItem[] };
    type Breakdown = { paid: PaidEntry[]; consumed: ConsumedEntry[] };

    const map = new Map<string, Breakdown>();
    for (const id of participantIds) map.set(id, { paid: [], consumed: [] });

    for (const receipt of receipts) {
      const title = receipt.title || "Untitled";
      const details = getPersonShareDetails(receipt, participantIds);
      const receiptSubtotal = receipt.items.reduce((s, i) => s + i.total, 0);
      const grandTotal = Math.round((receiptSubtotal + receipt.tax + receipt.service) * 100) / 100;
      const receiptDiscount = Math.round(details.reduce((s, d) => s + d.discount, 0) * 100) / 100;
      const amountPaid = Math.round((grandTotal - receiptDiscount) * 100) / 100;

      const payerEntry = map.get(receipt.payerId);
      if (payerEntry) payerEntry.paid.push({ receiptTitle: title, amount: amountPaid });

      for (const detail of details) {
        if (detail.total === 0) continue;
        const entry = map.get(detail.participantId);
        if (!entry) continue;
        entry.consumed.push({
          receiptTitle: title,
          amount: detail.total,
          items: detail.items
            .filter((it) => it.shareAmount > 0)
            .map((it) => ({ name: it.itemName, amount: it.shareAmount })),
        });
      }
    }

    return map;
  }, [receipts, participantIds]);

  const settlements = useMemo(
    () => minimizeTransactions(aggregateBalances),
    [aggregateBalances]
  );

  // Unique recipients (settlement "to" side), in settlement order. Payment
  // details are shown once per recipient in the "Rekening Tujuan" section.
  const recipientIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const s of settlements) {
      if (!seen.has(s.to)) {
        seen.add(s.to);
        ids.push(s.to);
      }
    }
    return ids;
  }, [settlements]);

  const { isPaid, togglePaid } = usePaidSettlements(`multiple:${splitId ?? splitName}`);

  const [showTrace, setShowTrace] = useState(false);

  const settlementTrace = useMemo(
    () => buildSettlementTrace(aggregateBalances, settlements),
    [aggregateBalances, settlements]
  );

  // Memoized name lookup — settlements + per-person breakdown can call this
  // many times; the previous .find() was O(n) per call, this is O(1).
  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) map.set(p.id, p.name);
    return map;
  }, [participants]);
  const getParticipantName = (id: string) => participantNames.get(id) || "Unknown";

  const participantsById = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const p of participants) map.set(p.id, p);
    return map;
  }, [participants]);

  // Deduped "Rekening tujuan" block for the copy text (one line per recipient),
  // mirroring the on-screen section. Empty string when no recipient has details.
  const formatPaymentDestinations = (ids: string[]): string => {
    const lines = ids
      .map((id) => ({
        name: getParticipantName(id),
        line: formatPaymentInfoText(participantsById.get(id)?.paymentInfo),
      }))
      .filter((d) => d.line);
    if (lines.length === 0) return "";
    return `\n🏦 Payment details:\n` + lines.map((d) => `• ${d.name}: ${d.line}\n`).join("");
  };

  const generateExportText = () => {
    let text = `🧾 ${splitName} — Multiple Receipts\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    text += `📋 ${receipts.length} receipt(s)\n`;
    text += `💳 Total: Rp ${formatCurrency(totalGrandTotal)}\n`;
    if (totalDiscount > 0) {
      text += `🏷️ Discount: -Rp ${formatCurrency(totalDiscount)}\n`;
      text += `✅ Amount paid: Rp ${formatCurrency(totalPaid)}\n`;
    }
    text += `\n`;

    if (settlements.length > 0) {
      text += `💸 Final Settlements:\n`;
      for (const s of settlements) {
        text += `• ${getParticipantName(s.from)} → ${getParticipantName(s.to)}: Rp ${formatCurrency(s.amount)}\n`;
      }
      text += formatPaymentDestinations(recipientIds);
    } else {
      text += `✅ Everyone is settled!\n`;
    }

    return text;
  };

  // Create the short link once, then reuse it. Returns null on failure (a toast
  // is shown), so callers can still proceed (e.g. copy the text without a link).
  const ensureShareUrl = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl;
    setCreatingLink(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // A trip with a budget is a Travel Spend share; carry the budget so
          // the shared view can show Budget vs Spent.
          type: budget != null ? "travel" : "multiple",
          title: splitName,
          participants,
          receipts,
          ...(budget != null ? { budget } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Request failed");
      }
      const { code } = await res.json();
      const url = `${window.location.origin}/s/${code}`;
      setShareUrl(url);
      return url;
    } catch (err) {
      toast({
        title: "Couldn't create share link",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
      return null;
    } finally {
      setCreatingLink(false);
    }
  };

  const handleShareLink = async () => {
    const url = await ensureShareUrl();
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${splitName} - Splitzy`, url });
        return;
      } catch {
        // User cancelled or share failed → fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Read-only view, valid for 14 days.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Couldn't copy link",
        description: "Please copy it manually.",
        variant: "error",
      });
    }
  };

  // "Copy" copies the human-readable summary with the short link appended, so a
  // WhatsApp message shows the split inline and links out to the full detail.
  const handleCopy = async () => {
    const url = await ensureShareUrl();
    let text = generateExportText();
    if (url) text += `\n🔗 View full breakdown:\n${url}\n`;
    text += splitzyCopyFooter(window.location.origin);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Please try again.",
        variant: "error",
      });
    }
  };

  if (receipts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Add receipts to see the summary</p>
        </CardContent>
      </Card>
    );
  }

  // Compact overview: totals + budget + per-person net only. The full breakdown
  // (wallet detail, settlements, payment accounts, receipts) lives on the
  // dedicated summary view.
  if (compact) {
    const over = budget != null && budget > 0 && totalPaid > budget;
    const pct = budget != null && budget > 0 ? Math.min(100, Math.round((totalPaid / budget) * 100)) : 0;
    return (
      <Card className={cn(!readOnly && "sticky top-4")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total spent</span>
            <span className="text-lg font-bold text-primary">Rp {formatCurrency(totalGrandTotal)}</span>
          </div>

          {budget != null && budget > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  Budget
                </span>
                <span className="font-medium">Rp {formatCurrency(budget)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : "bg-emerald-500")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className={cn("text-xs text-right", over ? "text-red-500 font-medium" : "text-muted-foreground")}>
                {over ? `Over by Rp ${formatCurrency(totalPaid - budget)}` : `Rp ${formatCurrency(budget - totalPaid)} left`}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Balances</h4>
            <div className="space-y-1">
              {Array.from(aggregateBalances.entries()).map(([id, net]) => (
                <div key={id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{getParticipantName(id)}</span>
                  <span
                    className={cn(
                      "font-semibold shrink-0",
                      net > 0.01
                        ? "text-emerald-600 dark:text-emerald-400"
                        : net < -0.01
                        ? "text-red-500"
                        : "text-muted-foreground"
                    )}
                  >
                    {net > 0.01 ? "+" : net < -0.01 ? "-" : ""}Rp {formatCurrency(Math.abs(net))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(!readOnly && "sticky top-4")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Summary
          </CardTitle>
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareLink}
                disabled={creatingLink}
                className="h-8 px-2 sm:px-3"
                aria-label="Create and share a read-only link"
              >
                {creatingLink ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline ml-1.5">Share</span>
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleCopy}
                disabled={creatingLink}
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
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Split Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Receipts</div>
          <div className="text-right font-medium">{receipts.length}</div>
          <div className="text-muted-foreground font-medium pt-2 border-t">
            Total
          </div>
          <div className={cn("text-right pt-2 border-t", totalDiscount > 0 ? "font-medium" : "font-bold text-primary")}>
            Rp {formatCurrency(totalGrandTotal)}
          </div>
          {totalDiscount > 0 && (
            <>
              <div className="text-emerald-600 dark:text-emerald-400">Discount</div>
              <div className="text-right text-emerald-600 dark:text-emerald-400">
                − Rp {formatCurrency(totalDiscount)}
              </div>
              <div className="text-muted-foreground font-medium pt-2 border-t">
                Amount Paid
              </div>
              <div className="text-right font-bold pt-2 border-t text-primary">
                Rp {formatCurrency(totalPaid)}
              </div>
            </>
          )}
        </div>

        {/* Budget vs Spent (Travel Spend) */}
        {budget != null && budget > 0 && (() => {
          const spent = totalPaid;
          const over = spent > budget;
          const pct = Math.min(100, Math.round((spent / budget) * 100));
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  Budget
                </span>
                <span className="font-medium">Rp {formatCurrency(budget)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : "bg-emerald-500")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className={cn("text-xs text-right", over ? "text-red-500 font-medium" : "text-muted-foreground")}>
                {over
                  ? `Over budget by Rp ${formatCurrency(spent - budget)}`
                  : `Rp ${formatCurrency(budget - spent)} left`}
                {" · "}spent Rp {formatCurrency(spent)}
              </p>
            </div>
          );
        })()}

        {/* Per-receipt details — expand a receipt to see who ordered what,
            the same breakdown as the single-receipt view. Hidden when the host
            (Travel Spend) surfaces these in its own Receipts list. */}
        {showReceiptDetails && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Receipt Details
              <span className="text-xs font-normal">(tap to expand)</span>
            </h4>
            <div className="space-y-2">
              {receipts.map((r, i) => (
                <ReceiptBreakdown
                  key={r.id}
                  receipt={r}
                  participants={participants}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

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
              const breakdown = walletBreakdowns.get(id);
              const isOpen = openWallet[id] ?? false;
              const hasDetails = (breakdown?.paid.length || 0) + (breakdown?.consumed.length || 0) > 0;

              return (
                <div key={id} className="rounded-lg border bg-card overflow-hidden">
                  {/* Header row — tappable to toggle */}
                  <button
                    type="button"
                    onClick={() => hasDetails && toggleWallet(id)}
                    className={`w-full text-left px-3 py-3 space-y-2 ${hasDetails ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{getParticipantName(id)}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            net > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : net < 0
                              ? "text-red-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {net > 0 ? "+" : net < 0 ? "-" : ""}Rp {formatCurrency(Math.abs(net))}
                        </span>
                        {hasDetails && (
                          isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-wrap justify-between gap-x-2 p-1.5 rounded bg-emerald-500/10">
                        <span className="text-emerald-700 dark:text-emerald-300">Paid</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">Rp {formatCurrency(paid)}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-2 p-1.5 rounded bg-orange-500/10">
                        <span className="text-orange-700 dark:text-orange-300">Consumed</span>
                        <span className="font-medium text-orange-700 dark:text-orange-300 whitespace-nowrap">Rp {formatCurrency(consumed)}</span>
                      </div>
                    </div>
                  </button>

                  {/* Expandable detail */}
                  {isOpen && breakdown && (
                    <div className="border-t border-border/50 px-3 py-3 space-y-4 text-xs">
                      {breakdown.paid.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Paid for</p>
                          {breakdown.paid.map((entry, i) => (
                            <div key={i} className="flex justify-between py-0.5 border-b border-border/30 last:border-0">
                              <span className="truncate pr-2 text-muted-foreground">{entry.receiptTitle}</span>
                              <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">Rp {formatCurrency(entry.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {breakdown.consumed.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">Consumed</p>
                          {breakdown.consumed.map((entry, i) => (
                            <div key={i}>
                              <div className="flex justify-between font-medium text-foreground/80 mb-0.5">
                                <span className="truncate pr-2">{entry.receiptTitle}</span>
                                <span className="shrink-0 text-orange-600 dark:text-orange-400">Rp {formatCurrency(entry.amount)}</span>
                              </div>
                              {entry.items.map((item, j) => (
                                <div key={j} className="flex justify-between pl-2 py-0.5 border-b border-border/20 last:border-0 text-muted-foreground">
                                  <span className="truncate pr-2">{item.name}</span>
                                  <span className="shrink-0">Rp {formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Final Settlements */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Final Settlements
            </h4>
            {settlements.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTrace((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-pressed={showTrace}
              >
                <Info className="h-3.5 w-3.5" />
                {showTrace ? "Hide explanation" : "How is this calculated?"}
              </button>
            )}
          </div>

          {/* Step-by-step settlement trace */}
          {showTrace && settlements.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Settlements are based on each person&apos;s <strong>net balance</strong> (total paid − total consumed) across all receipts, not on who paid for whom in a specific receipt. The app finds the fewest transfers needed to settle all balances.
              </p>

              {/* Starting net balances */}
              <div className="space-y-1">
                <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">Net balances before settlement</p>
                {Array.from(aggregateBalances.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, balance]) => (
                    <div key={id} className="flex items-center justify-between gap-2">
                      <span className="font-medium">{getParticipantName(id)}</span>
                      <span className={cn(
                        "font-mono text-right",
                        balance > 0.01 ? "text-emerald-600 dark:text-emerald-400" :
                        balance < -0.01 ? "text-red-500" :
                        "text-muted-foreground"
                      )}>
                        {balance > 0.01
                          ? `+Rp ${formatCurrency(balance)} (is owed)`
                          : balance < -0.01
                          ? `-Rp ${formatCurrency(Math.abs(balance))} (owes)`
                          : "settled"}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Step-by-step transfer trace */}
              <div className="space-y-2">
                <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">Step-by-step</p>
                {settlementTrace.map((step, i) => {
                  const fromAfter = step.balancesAfter.get(step.transfer.from) ?? 0;
                  const toAfter = step.balancesAfter.get(step.transfer.to) ?? 0;
                  return (
                    <div key={i} className="rounded border border-border/50 bg-background/60 px-2.5 py-2 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="text-red-500">{getParticipantName(step.transfer.from)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400">{getParticipantName(step.transfer.to)}</span>
                        <span className="ml-auto text-foreground">Rp {formatCurrency(step.transfer.amount)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground pl-0.5">
                        <span>
                          {getParticipantName(step.transfer.from)}:{" "}
                          {Math.abs(fromAfter) < 0.01
                            ? <span className="text-emerald-600 dark:text-emerald-400">settled ✓</span>
                            : <span>{fromAfter < -0.01 ? `-Rp ${formatCurrency(Math.abs(fromAfter))} still owes` : `+Rp ${formatCurrency(fromAfter)} remaining`}</span>
                          }
                        </span>
                        <span>·</span>
                        <span>
                          {getParticipantName(step.transfer.to)}:{" "}
                          {Math.abs(toAfter) < 0.01
                            ? <span className="text-emerald-600 dark:text-emerald-400">settled ✓</span>
                            : <span>{toAfter > 0.01 ? `+Rp ${formatCurrency(toAfter)} still owed` : `-Rp ${formatCurrency(Math.abs(toAfter))} remaining`}</span>
                          }
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {settlements.length === 0 ? (
            <div className="text-sm text-center py-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md">
              ✓ Everyone is settled!
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s) => {
                const key = settlementKey(s);
                const paid = isPaid(key);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => togglePaid(key)}
                    aria-pressed={paid}
                    aria-label={`${paid ? "Mark unpaid" : "Mark paid"}: ${getParticipantName(s.from)} pays ${getParticipantName(s.to)} Rp ${formatCurrency(s.amount)}`}
                    className={cn(
                      "group w-full flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm py-2 px-3 rounded-md text-left transition-colors",
                      paid
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                        : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          paid
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-muted-foreground/40 group-hover:border-primary"
                        )}
                        aria-hidden="true"
                      >
                        {paid && <Check className="h-3 w-3" />}
                      </span>
                      <span className={cn("font-medium truncate max-w-[80px] sm:max-w-none", paid && "line-through text-muted-foreground")}>
                        {getParticipantName(s.from)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={cn("font-medium truncate max-w-[80px] sm:max-w-none", paid && "line-through text-muted-foreground")}>
                        {getParticipantName(s.to)}
                      </span>
                    </div>
                    <span className={cn("font-bold sm:ml-auto", paid ? "text-emerald-600 dark:text-emerald-400" : "text-primary")}>
                      Rp {formatCurrency(s.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment destinations — one row per unique recipient (deduped). */}
        <PaymentDestinationsSection
          recipientIds={recipientIds}
          participantsById={participantsById}
          getParticipantName={getParticipantName}
          readOnly={readOnly}
          onUpdatePaymentInfo={onUpdatePaymentInfo}
        />
      </CardContent>
    </Card>
  );
}
