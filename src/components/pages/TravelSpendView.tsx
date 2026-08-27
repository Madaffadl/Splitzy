"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { TravelTrip, Receipt, Participant, PaymentInfo, TripMember, TripPayment } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useTravelData } from "@/hooks/useTravelData";
import { usePersistErrorToast } from "@/hooks/usePersistErrorToast";
import { fill, useDictionary } from "@/lib/i18n/use-locale";
import { useAuth } from "@/hooks/useAuth";
import { calculatePersonTotals, computeTripTotals, receiptInBaseCurrency, paymentInBaseCurrency } from "@/lib/calculations";
import { findSharePayment, paidShareParticipants, sharePaymentSource, pairSettlement, coveredShareParticipants, isManualPayment } from "@/lib/settle-up";
import { formatCurrency, cn } from "@/lib/utils";
import { generateId, todayDateString } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { ParticipantManager } from "@/components/ParticipantManager";
import { ReceiptEditor } from "@/components/ReceiptEditor";
import { MultipleReceiptSummaryPanel, ReceiptBreakdown } from "@/components/SummaryPanel";
import { ReviewInbox, ProposalBar } from "@/components/travel/ChangeRequests";
import { logFeatureUsage } from "@/lib/activity-client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  ArrowLeft,
  ArrowRight,
  Plane,
  Plus,
  Trash2,
  Users,
  Info,
  Target,
  Receipt as ReceiptIcon,
  Cloud,
  CheckCircle2,
  Loader2,
  Upload,
  Link2,
  Copy,
  MessageCircle,
  X,
  Crown,
  UserPlus,
  Wallet,
  ArrowRightLeft,
  RefreshCw,
  AlertTriangle,
  CloudOff,
  Archive,
  Globe,
  PartyPopper,
  Sparkles,
  Camera,
} from "@/components/ui/icons";
import { TRAVEL_CURRENCIES } from "@/lib/currencies";
import { setTripPref, archivedTripIds } from "@/lib/trip-prefs";
import { AppFooter } from "@/components/AppFooter";

type ViewMode = "overview" | "edit-receipt" | "summary";

interface EditingReceipt {
  receipt: Receipt;
  isNew: boolean;
}

// An in-progress receipt edit, persisted to localStorage so a refresh/crash
// while typing doesn't lose the work. Cleared on Save or Cancel. Device-local
// and ephemeral, so it isn't user-scoped (but is wiped on sign-out).
const DRAFT_KEY = "splitzy-travel-draft";
interface ReceiptDraft {
  tripId: string;
  receipt: Receipt;
  isNew: boolean;
}

function readDraft(): ReceiptDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ReceiptDraft) : null;
  } catch {
    return null;
  }
}
function writeDraft(draft: ReceiptDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // quota / disabled storage — best effort
  }
}
function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function parseAmount(s: string): number {
  const v = parseFloat(s.replace(/\./g, "").replace(/,/g, "."));
  return isNaN(v) || v < 0 ? 0 : v;
}

// Drop removed participants from receipts so no dangling payer/assignee refs
// break the balance math.
function reconcileReceipts(
  receipts: Receipt[],
  validIds: Set<string>
): { receipts: Receipt[]; dropped: number } {
  let dropped = 0;
  const out: Receipt[] = [];
  for (const r of receipts) {
    if (!validIds.has(r.payerId)) { dropped++; continue; }
    const items = r.items.map((it) => ({
      ...it,
      assignedToIds: it.assignedToIds.filter((id) => validIds.has(id)),
      ...(it.assignments
        ? { assignments: it.assignments.filter((a) => validIds.has(a.participantId)) }
        : {}),
    }));
    if (items.some((it) => it.assignedToIds.length === 0)) { dropped++; continue; }
    out.push({ ...r, items });
  }
  return { receipts: out, dropped };
}

// ── Sync Dialog ──────────────────────────────────────────────────────────────
function TravelSyncDialog({
  open,
  onSync,
  onDismiss,
  onKeepLocal,
}: {
  open: boolean;
  onSync: () => Promise<number>;
  onDismiss: () => void;
  onKeepLocal: () => void;
}) {
  const t = useDictionary().app.travel;
  const [status, setStatus] = useState<"idle" | "syncing" | "done">("idle");
  const [count, setCount] = useState(0);

  const handleSync = async () => {
    setStatus("syncing");
    const n = await onSync();
    setCount(n);
    setStatus("done");
  };

  const handleClose = () => {
    setStatus("idle");
    onDismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {status === "done" ? (
            <>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <DialogTitle className="text-center">{t.syncDone}</DialogTitle>
              <DialogDescription className="text-center">
                {fill(t.syncedCount, { count })}
              </DialogDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center">{t.syncTitle}</DialogTitle>
              <DialogDescription className="text-center">
                {fill(t.syncBody, { count })}
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          {status === "done" ? (
            <Button onClick={handleClose} className="w-full">{t.done}</Button>
          ) : (
            <>
              <Button onClick={handleSync} disabled={status === "syncing"} className="w-full gap-2">
                {status === "syncing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                {status === "syncing" ? t.syncing : t.syncNow}
              </Button>
              <Button variant="ghost" onClick={() => { handleClose(); onKeepLocal(); }} disabled={status === "syncing"} className="w-full">
                {t.keepLocalOnly}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Individual budgets card ────────────────────────────────────────────────
// Each traveler can set an optional personal spending target, tracked against
// their share of consumption across all receipts (settled receipts included —
// this is total spend, not the outstanding settlement).
function IndividualBudgets({
  participants,
  spent,
  onSetBudget,
}: {
  participants: Participant[];
  spent: Map<string, number>;
  onSetBudget: (participantId: string, budget: number | undefined) => void;
}) {
  const t = useDictionary().app.travel;
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const commit = (id: string) => {
    if (!(id in drafts)) return;
    const val = parseAmount(drafts[id]);
    onSetBudget(id, val > 0 ? val : undefined);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-success" />
          {t.individualBudgets}
        </CardTitle>
        <CardDescription>{t.individualBudgetsHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.addTravelersForBudgets}</p>
        ) : (
          participants.map((p) => {
            const budget = p.budget;
            const s = spent.get(p.id) ?? 0;
            const hasBudget = budget != null && budget > 0;
            const over = hasBudget && s > budget;
            const pct = hasBudget ? Math.min(100, Math.round((s / budget) * 100)) : 0;
            const draft = drafts[p.id];
            return (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                  <div className="relative w-28 shrink-0 sm:w-32">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">Rp</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="pl-8 h-11 text-base sm:h-9 sm:text-sm"
                      placeholder="0"
                      aria-label={fill(t.budgetAria, { name: p.name })}
                      value={draft !== undefined ? draft : hasBudget ? formatCurrency(budget) : ""}
                      onFocus={() => setDrafts((prev) => ({ ...prev, [p.id]: hasBudget ? String(budget) : "" }))}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      onBlur={() => commit(p.id)}
                      onKeyDown={(e) => e.key === "Enter" && commit(p.id)}
                    />
                  </div>
                </div>
                {hasBudget && (
                  <div className="pl-9 space-y-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : "bg-emerald-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className={cn("text-[11px]", over ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {fill(t.spentOf, { spent: formatCurrency(s), budget: formatCurrency(budget) })}
                      {over
                        ? fill(t.overBy, { amount: formatCurrency(s - budget) })
                        : fill(t.leftOver, { amount: formatCurrency(budget - s) })}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ── Settle-up payments card ────────────────────────────────────────────────
// Records money paid directly between travelers (e.g. "C paid E Rp 150,000"),
// including partial amounts. Each payment reduces the final settlement.
function SettleUpCard({
  participants,
  payments,
  defaultCurrency,
  onAdd,
  onDelete,
}: {
  participants: Participant[];
  payments: TripPayment[];
  defaultCurrency?: string;
  onAdd: (input: { from: string; to: string; amount: number; currency?: string; fxRate?: number; note?: string }) => void;
  onDelete: (paymentId: string) => void;
}) {
  const t = useDictionary().app.travel;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency && defaultCurrency !== "IDR" ? defaultCurrency : "IDR");
  const [fxRate, setFxRate] = useState("");
  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const isForeign = currency !== "IDR";
  const currencyMeta = TRAVEL_CURRENCIES.find((c) => c.code === currency);
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Unknown";

  const fetchRate = async (cur: string) => {
    if (!cur || cur === "IDR") return;
    setFetchingRate(true);
    setRateError(null);
    try {
      const res = await fetch(`/api/fx-rate?from=${encodeURIComponent(cur)}`);
      const data = (await res.json()) as { rate?: number; error?: string };
      if (!res.ok || !data.rate) {
        setRateError(data.error ?? t.rateFetchFailed);
      } else {
        setFxRate(String(data.rate));
      }
    } catch {
      setRateError(t.rateNetworkError);
    } finally {
      setFetchingRate(false);
    }
  };

  const handleCurrencyChange = (cur: string) => {
    setCurrency(cur);
    setFxRate("");
    setRateError(null);
    if (cur !== "IDR") void fetchRate(cur);
  };

  const submit = () => {
    const value = parseAmount(amount);
    if (!from || !to || from === to || value <= 0) return;
    if (isForeign && !parseFloat(fxRate)) return;
    const rate = isForeign ? parseFloat(fxRate) : undefined;
    onAdd({
      from, to, amount: value,
      ...(isForeign ? { currency, fxRate: rate } : {}),
      note: note.trim() || undefined,
    });
    setAmount("");
    setNote("");
  };

  const rateOk = !isForeign || (parseFloat(fxRate) > 0);
  const canSubmit = from && to && from !== to && parseAmount(amount) > 0 && rateOk;

  const displayAmount = (p: TripPayment) => {
    // Guard on `> 0` via the shared helper: a stored rate of 0 or a negative
    // rate used to slip through the bare truthiness check and render a
    // nonsensical (or negative) rupiah equivalent.
    if (p.currency && p.currency !== "IDR" && p.fxRate && p.fxRate > 0) {
      const idr = paymentInBaseCurrency(p);
      const sym = TRAVEL_CURRENCIES.find((c) => c.code === p.currency)?.symbol ?? p.currency;
      return (
        <span>
          {sym} {formatCurrency(p.amount)}
          <span className="text-muted-foreground font-normal"> ≈ Rp {formatCurrency(Math.round(idr))}</span>
        </span>
      );
    }
    return <span>Rp {formatCurrency(p.amount)}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-success" />
          {t.settleUp}
        </CardTitle>
        <CardDescription>{t.settleUpHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Existing payments */}
        {payments.length > 0 && (
          <ul className="space-y-1.5">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{nameOf(p.from)}</span>
                  <ArrowRightLeft className="mx-1 inline h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{nameOf(p.to)}</span>
                  {p.note ? <span className="text-muted-foreground"> · {p.note}</span> : null}
                </span>
                <span className="shrink-0 font-semibold text-success">
                  {displayAmount(p)}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  aria-label={t.deletePaymentAria}
                  className="touch-manipulation shrink-0 h-11 w-11 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add form */}
        {participants.length >= 2 ? (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            {/* From / To */}
            <div className="flex items-center gap-2">
              <select
                aria-label={t.payerAria}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="touch-manipulation min-w-0 flex-1 h-11 sm:h-9 rounded-md border bg-background px-2 text-base sm:text-sm"
              >
                <option value="">{t.from}</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ArrowRightLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              <select
                aria-label={t.recipientAria}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="touch-manipulation min-w-0 flex-1 h-11 sm:h-9 rounded-md border bg-background px-2 text-base sm:text-sm"
              >
                <option value="">{t.to}</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === from}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Currency + Amount. Note lives on its own row until sm: —
                three fields on one line leaves ~70px of typing space at 375px. */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t.currencyAria}
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="touch-manipulation h-11 sm:h-9 rounded-md border bg-background px-2 text-base sm:text-sm w-24 shrink-0"
              >
                <option value="IDR">IDR</option>
                {TRAVEL_CURRENCIES.filter((c) => c.code !== "IDR").map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              <div className="relative min-w-0 flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                  {isForeign ? (currencyMeta?.symbol ?? currency) : "Rp"}
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="pl-8 h-11 text-base sm:h-9 sm:text-sm"
                  placeholder={t.amountPlaceholder}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
              <Input
                className="basis-full sm:basis-0 flex-1 h-11 text-base sm:h-9 sm:text-sm"
                placeholder={t.notePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            {/* FX rate row (foreign currency only) */}
            {isForeign && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium leading-none">
                    1 {currencyMeta?.symbol ?? currency} =
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="pl-14 h-11 text-base sm:h-9 sm:text-sm"
                    placeholder={t.ratePlaceholder}
                    value={fxRate}
                    onChange={(e) => { setFxRate(e.target.value); setRateError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="touch-manipulation shrink-0 gap-1.5"
                  onClick={() => void fetchRate(currency)}
                  disabled={fetchingRate}
                >
                  {fetchingRate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {t.auto}
                </Button>
              </div>
            )}
            {rateError && <p className="text-xs text-warning">{rateError}</p>}
            {isForeign && parseFloat(fxRate) > 0 && parseAmount(amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ Rp {formatCurrency(Math.round(parseAmount(amount) * parseFloat(fxRate)))}
              </p>
            )}

            <Button size="sm" className="touch-manipulation h-11 w-full gap-2" onClick={submit} disabled={!canSubmit}>
              <Plus className="h-4 w-4" />
              {t.recordPayment}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.needTwoForPayments}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Members + Invite card ─────────────────────────────────────────────────────
interface InviteInfo { token: string; expiresAt: string }

function MembersCard({
  tripId,
  members,
  currentUserId,
}: {
  tripId: string;
  members: TripMember[];
  currentUserId: string | null;
}) {
  const { toast } = useToast();
  const isOwner = members.some((m) => m.userId === currentUserId && m.role === "owner");

  const t = useDictionary().app.travel;
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchInvites = useCallback(async () => {
    if (!isOwner) return;
    setLoadingInvites(true);
    try {
      const res = await fetch(`/api/travel/${tripId}/invites`);
      if (res.ok) {
        const { invites: list } = (await res.json()) as { invites: InviteInfo[] };
        setInvites(list);
      } else {
        setInviteError(t.inviteLoadFailed);
      }
    } catch {
      setInviteError(t.inviteLoadOffline);
    } finally {
      setLoadingInvites(false);
    }
  }, [tripId, isOwner, t]);

  useEffect(() => { void fetchInvites(); }, [fetchInvites]);

  const generateInvite = async () => {
    setGenerating(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/travel/${tripId}/invites`, { method: "POST" });
      if (res.ok) {
        const inv = (await res.json()) as InviteInfo;
        setInvites((prev) => [inv, ...prev]);
      } else {
        // Silence here meant the spinner stopped and nothing appeared.
        setInviteError(t.inviteCreateFailed);
      }
    } catch {
      setInviteError(t.inviteCreateOffline);
    } finally {
      setGenerating(false);
    }
  };

  // Revoking is how an owner takes back access after sending the link to the
  // wrong chat. It used to fire and forget: the row was filtered out of state
  // unconditionally, so a failed DELETE — offline, 403, 500 — left the owner
  // certain they had revoked a link that was still live. Confirm first, then
  // only drop it if the server agreed.
  const revokeInvite = async (token: string) => {
    setRevoking(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/travel/${tripId}/invites/${token}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setInviteError(t.revokeFailed);
        return;
      }
      setInvites((prev) => prev.filter((i) => i.token !== token));
      setConfirmRevoke(null);
      toast({ title: t.linkRevoked, variant: "success" });
    } catch {
      setInviteError(t.revokeFailed);
    } finally {
      setRevoking(false);
    }
  };

  const inviteUrl = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${token}`;

  // Unguarded `writeText` throws on a non-secure context or a denied
  // permission, and the success toast simply never fired — no error either.
  // SummaryPanel has caught this for its own copy for a while; this is the
  // path a collaborator's whole onboarding runs through.
  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopied(true);
      toast({ title: t.linkCopied, variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t.copyFailed,
        description: t.copyManually,
        variant: "error",
      });
    }
  };

  // The invite link is destined for a group chat — that is the whole point of
  // it — and every other share surface in this app already offers WhatsApp.
  const shareLinkToWhatsApp = (token: string) => {
    const text = `Join our trip on Splitzy: ${inviteUrl(token)}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const activeInvite = invites[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t.members}
        </CardTitle>
        <CardDescription>{fill(t.membersCount, { count: members.length })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Member list */}
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2">
              {m.avatarUrl ? (
                <Image src={m.avatarUrl} alt={m.name ?? m.email} width={28} height={28} className="rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                  {(m.name ?? m.email)[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-none truncate">
                  {m.name ?? m.email}
                  {m.userId === currentUserId && (
                    <span className="ml-1 text-xs text-muted-foreground">{t.you}</span>
                  )}
                </p>
              </div>
              {m.role === "owner" ? (
                <Crown className="h-3.5 w-3.5 shrink-0 text-warning" aria-label={t.owner} />
              ) : null}
            </li>
          ))}
        </ul>

        {/* Invite section — owner only */}
        {isOwner && (
          <div className="pt-3 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              {t.inviteLink}
            </p>
            {loadingInvites ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t.loadingInvite}
              </div>
            ) : activeInvite ? (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 space-y-2">
                <p className="text-xs text-muted-foreground break-all font-mono select-all">
                  {inviteUrl(activeInvite.token)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires{" "}
                  {new Date(activeInvite.expiresAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {/* Copy and Revoke used to be two 28px buttons 8px apart: the
                    action you take every time, flush against the one that
                    cannot be undone. Revoke moves to its own row, behind a
                    confirm, and the two sharing actions get the top row. */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="touch-manipulation flex-1 gap-1.5 text-xs"
                    onClick={() => void copyLink(activeInvite.token)}
                  >
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? t.copied : t.copy}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="touch-manipulation flex-1 gap-1.5 text-xs text-green-700 dark:text-green-500"
                    onClick={() => shareLinkToWhatsApp(activeInvite.token)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t.whatsapp}
                  </Button>
                </div>
                {confirmRevoke === activeInvite.token ? (
                  <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
                    <p className="text-xs text-foreground/90">
                      {t.revokeConfirm}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="touch-manipulation flex-1 text-xs"
                        disabled={revoking}
                        onClick={() => void revokeInvite(activeInvite.token)}
                      >
                        {revoking ? t.revoking : t.revokeYes}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="touch-manipulation flex-1 text-xs"
                        disabled={revoking}
                        onClick={() => setConfirmRevoke(null)}
                      >
                        {t.keepLink}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="touch-manipulation w-full gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => setConfirmRevoke(activeInvite.token)}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t.revokeLink}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="touch-manipulation w-full gap-2 text-xs"
                onClick={() => void generateInvite()}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                {t.generateInvite}
              </Button>
            )}
            {inviteError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {inviteError}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export function TravelSpendView() {
  const travel = useTravelData();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Warns when the browser has stopped accepting writes — full quota, or
  // storage blocked outright. Without this, a trip could gain receipts all day
  // and lose them on the next reload without a word.
  usePersistErrorToast(travel.persistError);
  const { dbUser, signOut } = useAuth();
  const t = useDictionary().app;
  const tt = t.travel;
  const tr = t.review;
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [editingReceipt, setEditingReceipt] = useState<EditingReceipt | null>(null);
  const [newTripName, setNewTripName] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null);
  const [deleteReceiptId, setDeleteReceiptId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    participants: Participant[];
    receipts: Receipt[];
    droppedIds: string[];
    droppedTitles: string[];
  } | null>(null);
  // Archived trip IDs — stored in localStorage, filtered from the active list.
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => archivedTripIds());
  const { toast } = useToast();

  const trips = useMemo(
    () => (travel.trips ?? []).filter((t) => !archivedIds.has(t.id)),
    [travel.trips, archivedIds]
  );
  // Change requests waiting on this user, per trip — surfaced on the list so an
  // owner does not have to open each trip to discover someone is blocked.
  const pendingFor = useCallback(
    (tripId: string) => (travel.changeRequests[tripId] ?? []).length,
    [travel.changeRequests]
  );
  const activeTrip = useMemo<TravelTrip | null>(() => {
    const raw = trips.find((t) => t.id === travel.activeId) ?? null;
    return raw
      ? { ...raw, participants: raw.participants ?? [], receipts: raw.receipts ?? [] }
      : null;
  }, [trips, travel.activeId]);

  // ── Approval workflow (cloud collaboration) ────────────────────────────────
  const activeRole = activeTrip ? travel.roleOf(activeTrip.id) : "owner";
  const isMemberOfActive = activeRole === "member";
  const activeProposal = activeTrip ? travel.proposals[activeTrip.id] : undefined;
  const pendingReviews = activeTrip ? travel.changeRequests[activeTrip.id] ?? [] : [];
  // While a member's proposal is submitted, editing is paused until the owner reviews it.
  const editingLocked = isMemberOfActive && activeProposal?.status === "submitted";
  const participantNameOf = useCallback(
    (id: string) => activeTrip?.participants.find((p) => p.id === id)?.name ?? tr.someone,
    [activeTrip, tr]
  );

  const handleSubmitProposal = useCallback(
    async (note?: string) => {
      if (!activeTrip) return false;
      const ok = await travel.submitChangeRequest(activeTrip.id, note);
      toast(
        ok
          ? { title: tr.submitted, description: tr.submittedBody, variant: "success" }
          : { title: tr.submitFailed, description: t.summary.tryAgain, variant: "error" }
      );
      return ok;
    },
    [activeTrip, travel, toast, t, tr]
  );

  const handleDiscardProposal = useCallback(() => {
    if (!activeTrip) return;
    travel.discardProposal(activeTrip.id);
    toast({ title: tr.draftDiscarded });
  }, [activeTrip, travel, toast, tr]);

  const handleApprove = useCallback(
    async (crId: string) => {
      if (!activeTrip) return false;
      const ok = await travel.approveChangeRequest(activeTrip.id, crId);
      toast(
        ok
          ? { title: tr.approved, variant: "success" }
          : { title: tr.approveFailed, description: tr.approveFailedBody, variant: "error" }
      );
      return ok;
    },
    [activeTrip, travel, toast, tr]
  );

  const handleDecline = useCallback(
    async (crId: string, note?: string) => {
      if (!activeTrip) return false;
      const ok = await travel.declineChangeRequest(activeTrip.id, crId, note);
      toast(ok ? { title: tr.declined } : { title: tr.declineFailed, variant: "error" });
      return ok;
    },
    [activeTrip, travel, toast, tr]
  );

  useEffect(() => {
    if (viewMode !== "overview") window.scrollTo({ top: 0, behavior: "instant" });
  }, [viewMode]);

  // ── Receipt draft persistence ──────────────────────────────────────────────
  // Restore an in-progress receipt on mount (survives refresh/crash mid-edit),
  // then keep localStorage in sync with the editor. Cancel/Save clear it.
  const draftReadyRef = useRef(false);
  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      travel.setActiveId(draft.tripId);
      setEditingReceipt({ receipt: draft.receipt, isNew: draft.isNew });
      setViewMode("edit-receipt");
    }
    draftReadyRef.current = true;
    // Mount-only: read once and restore. Intentionally not re-run on deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!draftReadyRef.current) return; // don't clear before the restore runs
    if (editingReceipt && viewMode === "edit-receipt") {
      // Only rewrite once the trip has hydrated; while it's still loading, leave
      // the restored draft untouched rather than clearing it.
      if (activeTrip) {
        writeDraft({ tripId: activeTrip.id, receipt: editingReceipt.receipt, isNew: editingReceipt.isNew });
      }
    } else {
      clearDraft();
    }
  }, [editingReceipt, viewMode, activeTrip]);

  // ── Navigation lives in the URL ────────────────────────────────────────────
  //
  // /travel had three levels of navigation — trip list, trip workspace, receipt
  // editor / trip summary — and not one of them had a URL. So the browser had no
  // history entry to go back to: pressing the Android back button or using
  // swipe-back from inside the receipt editor left /travel entirely, and coming
  // back landed on the trip list rather than the receipt being worked on. A trip
  // could not be bookmarked, linked, or reopened in a second tab either, which
  // is also why joining an invite could only ever drop the new member on the
  // list and leave them to find the trip themselves.
  //
  // The URL is authoritative for *where you are*; state still owns everything
  // else. The effect below only ever writes state, and the handlers only ever
  // write the URL, so the two cannot chase each other.
  const travelUrl = useCallback(
    (tripId: string | null, view?: "receipt" | "summary") => {
      if (!tripId) return "/travel";
      const q = new URLSearchParams({ trip: tripId });
      if (view) q.set("view", view);
      return `/travel?${q.toString()}`;
    },
    []
  );

  const tripParam = searchParams.get("trip");
  const viewParam = searchParams.get("view");

  // A pre-existing session (or a restored draft) can have a trip open with
  // nothing in the URL. Rewrite it once, without adding a history entry, so
  // Back from here has somewhere to go.
  const canonicalisedRef = useRef(false);
  useEffect(() => {
    if (canonicalisedRef.current) return;
    if (!travel.isLoading && !tripParam && travel.activeId) {
      canonicalisedRef.current = true;
      router.replace(
        travelUrl(travel.activeId, viewMode === "edit-receipt" ? "receipt" : undefined),
        { scroll: false }
      );
    }
  }, [travel.isLoading, tripParam, travel.activeId, viewMode, router, travelUrl]);

  useEffect(() => {
    if (tripParam) {
      if (tripParam !== travel.activeId) travel.setActiveId(tripParam);
    } else if (travel.activeId && canonicalisedRef.current) {
      // The trip param went away — Back out of a trip closes it.
      travel.setActiveId(null);
    }

    const next: ViewMode =
      viewParam === "summary"
        ? "summary"
        : viewParam === "receipt"
          ? "edit-receipt"
          : "overview";
    setViewMode((prev) => (prev === next ? prev : next));
    // travel.setActiveId is stable; listing `travel` whole would re-run this on
    // every trip mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripParam, viewParam]);

  // ?view=receipt with no draft to edit (a stale link, or a draft that was
  // saved in another tab) would render nothing at all. Send them to the trip.
  useEffect(() => {
    if (!draftReadyRef.current) return;
    if (viewParam === "receipt" && !editingReceipt && travel.activeId) {
      router.replace(travelUrl(travel.activeId), { scroll: false });
    }
  }, [viewParam, editingReceipt, travel.activeId, router, travelUrl]);

  // ── Trip CRUD ─────────────────────────────────────────────────────────────
  const createTrip = async () => {
    const name = newTripName.trim() || "My Trip";
    await travel.createTrip(name);
    setNewTripName("");
  };

  const deleteTrip = (id: string) => {
    const removed = trips.find((t) => t.id === id);
    setDeleteTripId(null);
    void travel.deleteTrip(id);
    toast({
      title: tt.tripDeleted,
      description: removed?.name,
      variant: "success",
      duration: 6000,
      action: removed ? { label: tt.undo, onClick: () => void travel.restoreTrip(removed) } : undefined,
    });
  };

  // Optimistic state plus a history entry: the state keeps the tap feeling
  // instant, the URL is what makes Back work.
  const openTrip = (id: string) => {
    setViewMode("overview");
    travel.setActiveId(id);
    router.push(travelUrl(id));
  };
  const closeTrip = () => {
    travel.setActiveId(null);
    router.push("/travel");
  };

  // ── Participants ──────────────────────────────────────────────────────────
  const handleParticipantsChange = async (participants: Participant[]) => {
    if (!activeTrip) return;
    const ids = new Set(participants.map((p) => p.id));
    const removedSomeone = activeTrip.participants.some((p) => !ids.has(p.id));
    if (!removedSomeone) {
      await travel.updateParticipants(activeTrip.id, participants);
      return;
    }
    const { receipts, dropped } = reconcileReceipts(activeTrip.receipts, ids);
    if (dropped === 0) {
      await travel.updateParticipants(activeTrip.id, participants, receipts);
      return;
    }
    // Receipts would be cascade-deleted — ask for confirmation first.
    const keptIds = new Set(receipts.map((r) => r.id));
    const droppedReceipts = activeTrip.receipts.filter((r) => !keptIds.has(r.id));
    setPendingRemoval({
      participants,
      receipts,
      droppedIds: droppedReceipts.map((r) => r.id),
      droppedTitles: droppedReceipts.map((r) => r.title),
    });
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval || !activeTrip) return;
    const { participants, receipts, droppedIds } = pendingRemoval;
    setPendingRemoval(null);
    await travel.updateParticipants(activeTrip.id, participants, receipts);
    for (const rid of droppedIds) void travel.deleteReceipt(activeTrip.id, rid);
    toast({
      title: fill(tt.receiptsRemoved, { count: droppedIds.length }),
      description: fill(tt.removeTravelerBody, { count: droppedIds.length }),
      variant: "success",
    });
  };

  const updateParticipantPaymentInfo = async (participantId: string, info: PaymentInfo | undefined) => {
    if (!activeTrip) return;
    const participants = activeTrip.participants.map((p) =>
      p.id === participantId ? { ...p, paymentInfo: info } : p
    );
    await travel.updateParticipants(activeTrip.id, participants);
  };

  const setParticipantBudget = async (participantId: string, budget: number | undefined) => {
    if (!activeTrip) return;
    const participants = activeTrip.participants.map((p) =>
      p.id === participantId ? { ...p, budget } : p
    );
    await travel.updateParticipants(activeTrip.id, participants);
  };

  // Per-person spend = their share of every receipt (settled included), used to
  // track each traveler against their individual budget.
  const spentByPerson = useMemo(() => {
    const map = new Map<string, number>();
    if (!activeTrip) return map;
    const ids = activeTrip.participants.map((p) => p.id);
    ids.forEach((id) => map.set(id, 0));
    for (const receipt of activeTrip.receipts) {
      // Convert to base currency so a person's spend across foreign + IDR
      // receipts is comparable to their (IDR) individual budget.
      for (const share of calculatePersonTotals(receiptInBaseCurrency(receipt), ids)) {
        map.set(
          share.participantId,
          Math.round(((map.get(share.participantId) ?? 0) + share.total) * 100) / 100
        );
      }
    }
    return map;
  }, [activeTrip]);

  // ── Receipts ──────────────────────────────────────────────────────────────
  const startNewReceipt = () => {
    if (!activeTrip) return;
    // Inherit the trip's default currency so the user doesn't pick it per-receipt.
    const defaultCurrency = activeTrip.defaultCurrency;
    const receipt: Receipt = {
      id: generateId(),
      title: `Receipt ${activeTrip.receipts.length + 1}`,
      date: todayDateString(),
      payerId: activeTrip.participants[0]?.id || "",
      items: [],
      tax: 0,
      service: 0,
      ...(defaultCurrency && defaultCurrency !== "IDR" ? { currency: defaultCurrency } : {}),
    };
    setEditingReceipt({ receipt, isNew: true });
    setViewMode("edit-receipt");
    router.push(travelUrl(activeTrip.id, "receipt"));
  };

  const editReceipt = (id: string) => {
    const receipt = activeTrip?.receipts.find((r) => r.id === id);
    if (receipt && activeTrip) {
      setEditingReceipt({ receipt: { ...receipt }, isNew: false });
      setViewMode("edit-receipt");
      router.push(travelUrl(activeTrip.id, "receipt"));
    }
  };

  const updateEditingReceipt = (updates: Partial<Receipt>) => {
    setEditingReceipt((prev) => (prev ? { ...prev, receipt: { ...prev.receipt, ...updates } } : prev));
  };

  // Persist a receipt and report the *real* outcome. Navigation stays optimistic
  // (snappy), but the success toast only fires once the server confirms the save;
  // on failure the optimistic receipt is already rolled back by the data layer,
  // so we surface an error with a Retry action instead of a false "saved".
  const submitReceipt = (tripId: string, receipt: Receipt, isNew: boolean) => {
    void (async () => {
      const ok = isNew
        ? await travel.addReceipt(tripId, receipt)
        : await travel.updateReceipt(tripId, receipt);
      if (ok) {
        toast({ title: isNew ? tt.receiptAdded : tt.receiptUpdated, description: receipt.title, variant: "success" });
        logFeatureUsage("travel", "receipt.added");
      } else {
        toast({
          title: tt.receiptSaveFailed,
          description: fill(tt.receiptSaveFailedBody, { title: receipt.title }),
          variant: "error",
          duration: 8000,
          action: { label: tt.retry, onClick: () => submitReceipt(tripId, receipt, isNew) },
        });
      }
    })();
  };

  const saveReceipt = () => {
    if (!activeTrip || !editingReceipt) return;
    const { receipt, isNew } = editingReceipt;
    const tripId = activeTrip.id;
    // Redirect immediately for a snappy feel; the outcome is reported by the
    // toast inside submitReceipt once the background save resolves.
    setEditingReceipt(null);
    setViewMode("overview");
    router.replace(travelUrl(tripId), { scroll: false });
    submitReceipt(tripId, receipt, isNew);
  };

  const deleteReceipt = (id: string) => {
    if (!activeTrip) return;
    const tripId = activeTrip.id;
    const removed = activeTrip.receipts.find((r) => r.id === id);
    setDeleteReceiptId(null);
    void travel.deleteReceipt(tripId, id);
    toast({
      title: tt.receiptDeleted,
      description: removed?.title,
      variant: "success",
      duration: 6000,
      action: removed ? { label: tt.undo, onClick: () => void travel.addReceipt(tripId, removed) } : undefined,
    });
  };

  // Effective share of a receipt for one participant (used to size the payment
  // recorded when their share is marked paid). Converted to the base currency
  // (IDR) so the ledger payment matches the IDR settlement balances — recording
  // a native foreign amount here would over/under-settle a foreign receipt.
  const shareOf = (receipt: Receipt, participantId: string): number => {
    const ids = (activeTrip?.participants ?? []).map((p) => p.id);
    return calculatePersonTotals(receiptInBaseCurrency(receipt), ids).find((s) => s.participantId === participantId)?.total ?? 0;
  };

  // Toggle one person's share of a receipt as paid. This is a ledger payment
  // (from → payer) — the single source of truth — not a flag on the receipt.
  const togglePaidShare = (receiptId: string, participantId: string) => {
    if (!activeTrip) return;
    const receipt = activeTrip.receipts.find((r) => r.id === receiptId);
    if (!receipt || participantId === receipt.payerId) return;
    const existing = findSharePayment(activeTrip.payments, receiptId, participantId);
    if (existing) {
      void travel.deletePayment(activeTrip.id, existing.id);
    } else {
      // B1: record only the *remaining* debt, never the full share on top of what
      // was already paid (e.g. an earlier partial manual "B paid A 50k"). Recording
      // the full share would over-settle and flip the payer negative — the ghost
      // "+Rp 50.000 / -Rp 50.000" balance. remaining = owed − already-paid.
      const ids = activeTrip.participants.map((p) => p.id);
      const { owed, paid } = pairSettlement(activeTrip.receipts, ids, activeTrip.payments, participantId, receipt.payerId);
      const remaining = Math.round((owed - paid) * 100) / 100;
      if (remaining <= 0) {
        const nameOf = (id: string) => activeTrip.participants.find((p) => p.id === id)?.name ?? "?";
        toast({
          title: tt.alreadySettled,
          description: fill(tt.alreadySettledBody, {
            from: nameOf(participantId),
            to: nameOf(receipt.payerId),
          }),
        });
        return;
      }
      const amount = Math.round(Math.min(shareOf(receipt, participantId), remaining) * 100) / 100;
      if (amount <= 0) return;
      void travel.addPayment(activeTrip.id, {
        from: participantId,
        to: receipt.payerId,
        amount,
        source: sharePaymentSource(receiptId, participantId),
      });
    }
  };

  // Whole-receipt shortcut: mark every non-payer's share paid (or, if all are
  // already paid, undo them). Each is a ledger payment.
  const toggleReceiptPaid = (receiptId: string) => {
    if (!activeTrip) return;
    const receipt = activeTrip.receipts.find((r) => r.id === receiptId);
    if (!receipt) return;
    // Only non-payers who actually owe something (share > 0) can be settled.
    const owing = activeTrip.participants
      .filter((p) => p.id !== receipt.payerId)
      .map((p) => ({ id: p.id, amount: shareOf(receipt, p.id) }))
      .filter((p) => p.amount > 0);
    const ids = activeTrip.participants.map((p) => p.id);
    const paidSet = paidShareParticipants(activeTrip.payments, receiptId);
    const allPaid = owing.length > 0 && owing.every((p) => paidSet.has(p.id));
    for (const p of owing) {
      const existing = findSharePayment(activeTrip.payments, receiptId, p.id);
      if (allPaid && existing) {
        void travel.deletePayment(activeTrip.id, existing.id);
      } else if (!allPaid && !existing) {
        // B1: cap to the remaining debt so an earlier (partial) payment isn't
        // double-counted — never record more than this person still owes.
        const { owed, paid } = pairSettlement(activeTrip.receipts, ids, activeTrip.payments, p.id, receipt.payerId);
        const remaining = Math.round((owed - paid) * 100) / 100;
        if (remaining <= 0) continue;
        const amount = Math.round(Math.min(p.amount, remaining) * 100) / 100;
        if (amount <= 0) continue;
        void travel.addPayment(activeTrip.id, {
          from: p.id,
          to: receipt.payerId,
          amount,
          source: sharePaymentSource(receiptId, p.id),
        });
      }
    }
  };

  // Record / remove a direct settle-up payment between two travelers.
  const addSettleUp = (input: { from: string; to: string; amount: number; currency?: string; fxRate?: number; note?: string; source?: string }) => {
    if (!activeTrip) return;
    void travel.addPayment(activeTrip.id, input);
    const nameOf = (id: string) => activeTrip.participants.find((p) => p.id === id)?.name ?? "?";
    const isForeign = input.currency && input.currency !== "IDR" && input.fxRate;
    const displayAmt = isForeign
      ? `${TRAVEL_CURRENCIES.find((c) => c.code === input.currency)?.symbol ?? input.currency} ${formatCurrency(input.amount)}`
      : `Rp ${formatCurrency(input.amount)}`;
    toast({
      title: tt.paymentRecorded,
      description: `${nameOf(input.from)} → ${nameOf(input.to)}: ${displayAmt}`,
      variant: "success",
    });
  };
  const deleteSettleUp = (paymentId: string) => {
    if (!activeTrip) return;
    void travel.deletePayment(activeTrip.id, paymentId);
  };

  // Editing pauses for a member while their submitted proposal awaits review.
  const canAddReceipt = (activeTrip?.participants.length ?? 0) >= 2 && !editingLocked;

  // ── Trip name sync on blur ────────────────────────────────────────────────
  const commitName = async () => {
    if (nameDraft !== null && activeTrip) {
      await travel.updateTrip(activeTrip.id, { name: nameDraft.trim() || "My Trip" });
      setNameDraft(null);
    }
  };

  // ── Default currency ──────────────────────────────────────────────────────
  const setDefaultCurrency = async (currency: string) => {
    if (!activeTrip) return;
    const value = currency === "IDR" ? undefined : currency;
    await travel.updateTrip(activeTrip.id, { defaultCurrency: value });
    setTripPref(activeTrip.id, { defaultCurrency: value });
  };

  // ── Settlement totals + "all settled" state ───────────────────────────────
  const tripTotals = useMemo(() => {
    if (!activeTrip || activeTrip.receipts.length === 0) return null;
    return computeTripTotals(
      activeTrip.receipts,
      activeTrip.participants.map((p) => p.id),
      activeTrip.payments ?? []
    );
  }, [activeTrip]);

  const allSettled =
    !!tripTotals &&
    tripTotals.totalGrandTotal > 0 &&
    tripTotals.settlements.length === 0;

  // Per-receipt "covered" sets: a share reads as paid if it has an explicit
  // share payment OR the person is already fully settled with the payer (manual
  // settle-ups included). Computed once so the receipt list reflects the whole
  // ledger consistently. See coveredShareParticipants.
  const coveredByReceipt = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!activeTrip) return map;
    const ids = activeTrip.participants.map((p) => p.id);
    for (const r of activeTrip.receipts) {
      map.set(r.id, coveredShareParticipants(activeTrip.receipts, ids, activeTrip.payments, r.id));
    }
    return map;
  }, [activeTrip]);

  // ── Archive ───────────────────────────────────────────────────────────────
  const archiveTrip = (id: string) => {
    const next = new Set(archivedIds).add(id);
    setArchivedIds(next);
    setTripPref(id, { archivedAt: new Date().toISOString() });
    travel.setActiveId(null);
    toast({ title: tt.tripArchived, description: tt.tripArchivedBody, variant: "success" });
  };

  const unarchiveTrip = (id: string) => {
    const next = new Set(archivedIds);
    next.delete(id);
    setArchivedIds(next);
    setTripPref(id, { archivedAt: undefined });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* `=== "summary"`, not `!== "overview"`. The receipt editor's back
              duplicated its own Cancel, so it goes; the trip summary has no
              other way out, so removing its back would strand the user there. */}
          {activeTrip && viewMode === "summary" ? (
            <button
              onClick={() => {
                setEditingReceipt(null);
                setViewMode("overview");
                if (activeTrip) router.push(travelUrl(activeTrip.id));
              }}
              aria-label={t.modes.travel.backToTrip}
              className="touch-manipulation -ml-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">{t.modes.travel.backToTrip}</span>
            </button>
          ) : activeTrip ? (
            <button
              onClick={closeTrip}
              aria-label={t.modes.travel.allTrips}
              className="touch-manipulation -ml-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">{t.modes.travel.allTrips}</span>
            </button>
          ) : (
            <Link href="/" aria-label={t.common.back} className="touch-manipulation -ml-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">{t.common.back}</span>
            </Link>
          )}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Plane className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm sm:text-base">{t.modes.travel.title}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow w-full">
        {/* Status banner */}
        {travel.isLoading ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-muted p-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">{tt.loading}</p>
          </div>
        ) : travel.cloudMode && travel.syncStatus === "conflict" ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-foreground/90">
              <span className="font-semibold text-destructive">{tt.outOfSync}</span>{" "}
              {tt.outOfSyncBody}
            </p>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => void travel.reloadCloud()}>
              <RefreshCw className="h-3.5 w-3.5" /> {tt.reload}
            </Button>
          </div>
        ) : travel.cloudMode && travel.syncStatus === "error" ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="flex-1 text-foreground/90">
              <span className="font-semibold text-warning">{tt.maybeUnsaved}</span>{" "}
              {travel.syncError}
            </p>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => void travel.reloadCloud()}>
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        ) : travel.cloudMode && travel.pendingSync && !travel.isOnline ? (
          // Local-first: the change is safely on this device; it just hasn't
          // reached the server yet. Calm, not alarming — no data is at risk.
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <p className="text-foreground/90">
              <span className="font-semibold text-sky-700 dark:text-sky-300">{tt.savedOnDevice}</span>{" "}
              {tt.savedOnDeviceOffline}
            </p>
          </div>
        ) : travel.cloudMode ? (
          // Everything is fine, which does not need a banner. This one was
          // permanent and undismissable: on a 375x667 phone the header plus this
          // paragraph spent about 19% of the viewport telling the user that
          // nothing was wrong, on every single visit. The states that need
          // attention — conflict, error, offline — still get the full banner
          // above; "saved" is now a chip you can glance at and ignore.
          <div className="mb-4 flex justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              {travel.syncStatus === "saving" || travel.pendingSync ? (
                <>
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  {tt.saving}
                </>
              ) : (
                <>
                  <Cloud className="h-3 w-3 shrink-0" />
                  {tt.savedToAccount}
                </>
              )}
            </span>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-foreground/90">
              <span className="font-semibold text-warning">{tt.localOnly}</span>{" "}
              {tt.localOnlyBody}
            </p>
          </div>
        )}

        {/* ── Trip list ── */}
        {!activeTrip && (
          <div className="space-y-6">
            {/* First-impression hero — only when the user has no trips yet.
                Communicates the differentiated value (why Travel Spend ≠ a plain
                receipt splitter) before asking them to create anything. */}
            {!travel.isLoading && trips.length === 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 via-teal-50/60 to-background dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-background p-6 sm:p-8 text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Plane className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{tt.heroTitle}</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  {tt.heroBody}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium">
                    <Cloud className="h-3.5 w-3.5 text-success" />
                    {tt.cloudSync}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium">
                    <Camera className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    {tt.aiScan}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium">
                    <Globe className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    {tt.multiCurrency}
                  </span>
                </div>
                <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-warning" />
                  {tt.nameItBelow}
                </p>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-success" />
                  {tt.newTrip}
                </CardTitle>
                <CardDescription>{tt.newTripHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={newTripName}
                    onChange={(e) => setNewTripName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void createTrip()}
                    placeholder={tt.tripNamePlaceholder}
                  />
                  <Button onClick={() => void createTrip()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {tt.create}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {travel.isLoading ? (
              // Skeleton trip cards while cloud trips load (avoids a flash of the
              // "No trips yet" empty state before data arrives).
              <div className="grid sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-4 rounded-xl border">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : trips.length === 0 ? (
              // Empty state is fully covered by the hero above — nothing here.
              null
            ) : (
              <>
              <div className="grid sm:grid-cols-2 gap-3">
                {trips.map((t) => {
                  // Convert each receipt to base currency before summing so a
                  // multi-currency trip's headline total isn't ₫ + Rp mixed.
                  const total = (t.receipts ?? []).reduce((s, raw) => {
                    const r = receiptInBaseCurrency(raw);
                    return s + r.items.reduce((x, i) => x + i.total, 0) + r.tax + r.service;
                  }, 0);
                  const hasForeignCurrency = (t.receipts ?? []).some(
                    (r) => r.currency && r.currency !== "IDR"
                  );
                  return (
                    // A role="button" container with a <Button> inside it is a
                    // nested control: ambiguous for a screen reader, and the
                    // stopPropagation only ever patched the mouse side. The row
                    // is a plain container now; the name is the link, Delete is
                    // its own button, and they no longer share a hit area.
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-xl border transition-colors hover:bg-muted/40"
                    >
                      <button
                        type="button"
                        onClick={() => openTrip(t.id)}
                        className="touch-manipulation min-w-0 flex-1 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{t.name}</p>
                          {pendingFor(t.id) > 0 && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                              {fill(tt.toReview, { count: pendingFor(t.id) })}
                            </span>
                          )}
                          {hasForeignCurrency && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                              <Globe className="h-2.5 w-2.5" />
                              {tt.multiCurrencyBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fill(tt.peopleReceipts, { people: t.participants.length, receipts: (t.receipts ?? []).length })}
                          {t.budget ? fill(tt.budgetSuffix, { amount: formatCurrency(t.budget) }) : ""}
                        </p>
                        <p className="mt-1 text-sm font-semibold">Rp {formatCurrency(total)}</p>
                      </button>
                      {/* ml-2/pr-2 keeps a real gap between "open this trip" and
                          "delete this trip", which used to be 8px apart with the
                          amount wedged between them. */}
                      <div className="flex shrink-0 items-center pr-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={fill(tt.deleteTripAria, { name: t.name })}
                          className="touch-manipulation ml-2 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTripId(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Archived trips count + unarchive */}
              {archivedIds.size > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  <span>
                    <Archive className="inline h-3.5 w-3.5 mr-1.5 opacity-70" />
                    {fill(tt.archivedCount, { count: archivedIds.size })}
                  </span>
                  <button
                    className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
                    onClick={() => {
                      const ids = [...archivedIds];
                      ids.forEach((id) => unarchiveTrip(id));
                    }}
                  >
                    {tt.showAll}
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        )}

        {/* ── Trip workspace: overview ── */}
        {activeTrip && viewMode === "overview" && (
          <div className="space-y-6">
            {/* Approval workflow: owner review inbox + member proposal status */}
            {travel.cloudMode && activeRole === "owner" && (
              <ReviewInbox
                requests={pendingReviews}
                tripVersion={activeTrip.version}
                nameOf={participantNameOf}
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            )}
            {travel.cloudMode && isMemberOfActive && (
              <ProposalBar
                proposal={activeProposal}
                nameOf={participantNameOf}
                onSubmit={handleSubmitProposal}
                onDiscard={handleDiscardProposal}
              />
            )}

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Trip details + budget */}
              <Card>
                <CardHeader>
                  <CardTitle>{tt.tripDetails}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{tt.tripName}</Label>
                    <Input
                      value={nameDraft !== null ? nameDraft : activeTrip.name}
                      onFocus={() => setNameDraft(activeTrip.name)}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => void commitName()}
                      onKeyDown={(e) => e.key === "Enter" && void commitName()}
                      placeholder="e.g., Bali 2026"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Target className="h-4 w-4" />
                      {tt.budgetOptional}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="pl-10"
                        placeholder="0"
                        value={budgetDraft !== null ? budgetDraft : activeTrip.budget ? formatCurrency(activeTrip.budget) : ""}
                        onFocus={() => setBudgetDraft(activeTrip.budget ? String(activeTrip.budget) : "")}
                        onChange={(e) => setBudgetDraft(e.target.value)}
                        onBlur={async () => {
                          if (budgetDraft !== null) {
                            const val = parseAmount(budgetDraft);
                            await travel.updateTrip(activeTrip.id, { budget: val > 0 ? val : undefined });
                            setBudgetDraft(null);
                          }
                        }}
                      />
                    </div>
                  </div>
                  </div>

                  {/* Default currency — sets what new receipts inherit */}
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">{tt.defaultCurrency}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={activeTrip.defaultCurrency ?? "IDR"}
                        onChange={(e) => void setDefaultCurrency(e.target.value)}
                        className="touch-manipulation flex h-11 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:text-sm"
                      >
                        {TRAVEL_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.symbol}  {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                      {activeTrip.defaultCurrency && activeTrip.defaultCurrency !== "IDR" && (
                        <p className="text-xs text-muted-foreground">
                          {fill(tt.newReceiptsDefault, { code: activeTrip.defaultCurrency })}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Travelers */}
              <Card>
                <CardHeader>
                  <CardTitle>{tt.travelers}</CardTitle>
                  <CardDescription>{tt.travelersHint}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ParticipantManager
                    participants={activeTrip.participants}
                    onChange={(p) => void handleParticipantsChange(p)}
                  />
                </CardContent>
              </Card>

              {/* Individual budgets */}
              {activeTrip.participants.length > 0 && (
                <IndividualBudgets
                  participants={activeTrip.participants}
                  spent={spentByPerson}
                  onSetBudget={(id, budget) => void setParticipantBudget(id, budget)}
                />
              )}

              {/* Receipts */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle>{tt.receipts}</CardTitle>
                    <CardDescription>
                      {fill(tt.receiptsCount, { count: activeTrip.receipts.length })}
                    </CardDescription>
                  </div>
                  <Button onClick={startNewReceipt} disabled={!canAddReceipt}>
                    <Plus className="h-4 w-4 mr-2" />
                    {tt.addReceipt}
                  </Button>
                </CardHeader>
                <CardContent>
                  {!canAddReceipt ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-primary opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">{tt.addTravelersFirst}</p>
                      <p className="text-sm text-muted-foreground max-w-xs">{tt.addTravelersFirstBody}</p>
                    </div>
                  ) : activeTrip.receipts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                        <ReceiptIcon className="h-6 w-6 text-accent-strong" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">{tt.noReceiptsTitle}</p>
                      <p className="text-sm text-muted-foreground mb-4">{tt.noReceiptsBody}</p>
                      <Button size="sm" variant="secondary" onClick={startNewReceipt}>
                        <Plus className="h-4 w-4 mr-2" />
                        {tt.addReceipt}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{tt.tapReceiptHint}</p>
                      {activeTrip.receipts.map((r, i) => (
                        <ReceiptBreakdown
                          key={r.id}
                          receipt={r}
                          participants={activeTrip.participants}
                          index={i}
                          onEdit={() => editReceipt(r.id)}
                          onDelete={() => setDeleteReceiptId(r.id)}
                          paidParticipantIds={coveredByReceipt.get(r.id)}
                          onToggleAllPaid={() => toggleReceiptPaid(r.id)}
                          onTogglePaidShare={(pid) => togglePaidShare(r.id, pid)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Settle-up payments */}
              <SettleUpCard
                participants={activeTrip.participants}
                payments={(activeTrip.payments ?? []).filter(isManualPayment)}
                defaultCurrency={activeTrip.defaultCurrency}
                onAdd={addSettleUp}
                onDelete={deleteSettleUp}
              />

              {/* ── All Settled celebration ─────────────────────────────── */}
              {allSettled && (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-6 text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <PartyPopper className="h-7 w-7 text-success" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                      {tt.allSettledTitle}
                    </h3>
                    <p className="text-sm text-success mt-1">
                      {activeTrip.name} · {activeTrip.receipts.length} receipt{activeTrip.receipts.length !== 1 ? "s" : ""} ·{" "}
                      Rp {formatCurrency(tripTotals!.totalGrandTotal)} total
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center flex-wrap">
                    <Button variant="outline" className="border-emerald-300 dark:border-emerald-700" onClick={() => router.push(travelUrl(activeTrip.id, "summary"))}>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      {tt.viewSummary}
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      onClick={() => archiveTrip(activeTrip.id)}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      {tt.archiveTrip}
                    </Button>
                  </div>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 border-t border-emerald-200 dark:border-emerald-800 pt-3">
                    {tt.proTeaser}
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTripId(activeTrip.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {tt.deleteTrip}
                </Button>
              </div>
            </div>

            {/* Summary sidebar — compact */}
            <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
              <ErrorBoundary label="the trip summary">
                <MultipleReceiptSummaryPanel
                  receipts={activeTrip.receipts}
                  participants={activeTrip.participants}
                  splitName={activeTrip.name}
                  splitId={activeTrip.id}
                  budget={activeTrip.budget}
                  payments={activeTrip.payments}
                  compact
                  onUpdatePaymentInfo={(id, info) => void updateParticipantPaymentInfo(id, info)}
                />
              </ErrorBoundary>
              {activeTrip.receipts.length > 0 && (
                <Button variant="outline" className="w-full" onClick={() => router.push(travelUrl(activeTrip.id, "summary"))}>
                  {tt.viewSummary}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {/* Members card — cloud mode only (members are a cloud-only feature) */}
              {travel.cloudMode && (activeTrip.members?.length ?? 0) > 0 && (
                <MembersCard
                  tripId={activeTrip.id}
                  members={activeTrip.members!}
                  currentUserId={dbUser?.id ?? null}
                />
              )}
            </div>
          </div>
          </div>
        )}

        {/* ── Trip workspace: full summary ── */}
        {activeTrip && viewMode === "summary" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div>
              <h1 className="text-xl font-bold">{activeTrip.name}</h1>
              <p className="text-sm text-muted-foreground">{tt.fullTripSummary}</p>
            </div>
            <ErrorBoundary label="the trip summary">
              <MultipleReceiptSummaryPanel
                receipts={activeTrip.receipts}
                participants={activeTrip.participants}
                splitName={activeTrip.name}
                splitId={activeTrip.id}
                budget={activeTrip.budget}
                payments={activeTrip.payments}
                onUpdatePaymentInfo={(id, info) => void updateParticipantPaymentInfo(id, info)}
                onToggleReceiptPaid={(rid) => toggleReceiptPaid(rid)}
                onTogglePaidShare={(rid, pid) => togglePaidShare(rid, pid)}
                onRecordPayment={(from, to, amount) => addSettleUp({ from, to, amount })}
                onDeletePayment={deleteSettleUp}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* ── Trip workspace: edit receipt ── */}
        {activeTrip && viewMode === "edit-receipt" && editingReceipt && (
          <ReceiptEditor
            receipt={editingReceipt.receipt}
            participants={activeTrip.participants}
            isNew={editingReceipt.isNew}
            onChange={updateEditingReceipt}
            onSave={saveReceipt}
            onCancel={() => {
              setEditingReceipt(null);
              setViewMode("overview");
              router.push(travelUrl(activeTrip.id));
            }}
            onUpdatePaymentInfo={(id, info) => void updateParticipantPaymentInfo(id, info)}
            isTravelMode
          />
        )}
      </div>

      {/* Confirm traveler removal when receipts would cascade-delete */}
      <Dialog open={pendingRemoval !== null} onOpenChange={(o) => !o && setPendingRemoval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt.removeTravelerTitle}</DialogTitle>
            <DialogDescription>
              Removing this traveler will also delete the following receipt{pendingRemoval?.droppedTitles.length !== 1 ? "s" : ""} that reference them:
            </DialogDescription>
          </DialogHeader>
          {pendingRemoval && (
            <ul className="text-sm space-y-1 my-1 pl-1">
              {pendingRemoval.droppedTitles.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-muted-foreground">
                  <ReceiptIcon className="h-3.5 w-3.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingRemoval(null)}>{tr.cancel}</Button>
            <Button variant="destructive" onClick={() => void confirmRemoval()}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove & delete receipts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete trip confirm */}
      <Dialog open={deleteTripId !== null} onOpenChange={() => setDeleteTripId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt.deleteTripTitle}</DialogTitle>
            <DialogDescription>
              The trip and all its receipts will be removed. You can undo this using the notification that appears.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTripId(null)}>{tr.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteTripId && deleteTrip(deleteTripId)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete receipt confirm */}
      <Dialog open={deleteReceiptId !== null} onOpenChange={() => setDeleteReceiptId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.multiple.deleteTitle}</DialogTitle>
            <DialogDescription>
              The receipt will be removed. You can undo this using the notification that appears.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteReceiptId(null)}>{tr.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteReceiptId && void deleteReceipt(deleteReceiptId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guest → cloud sync dialog */}
      <TravelSyncDialog
        open={travel.showSyncDialog}
        onSync={travel.syncLocalToCloud}
        onDismiss={travel.dismissSyncDialog}
        onKeepLocal={() => void signOut()}
      />

      <AppFooter />
    </main>
  );
}
