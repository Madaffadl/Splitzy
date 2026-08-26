"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { TravelTrip, Receipt, Participant, PaymentInfo, TripMember, TripPayment } from "@/types";
import { useTravelData } from "@/hooks/useTravelData";
import { usePersistErrorToast } from "@/hooks/usePersistErrorToast";
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
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <DialogTitle className="text-center">Sync complete</DialogTitle>
              <DialogDescription className="text-center">
                {count} trip{count !== 1 ? "s" : ""} synced to your account.
              </DialogDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center">Sync trips to cloud?</DialogTitle>
              <DialogDescription className="text-center">
                You have trips saved on this device. Sync them to your account so they&apos;re accessible anywhere.
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          {status === "done" ? (
            <Button onClick={handleClose} className="w-full">Done</Button>
          ) : (
            <>
              <Button onClick={handleSync} disabled={status === "syncing"} className="w-full gap-2">
                {status === "syncing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                {status === "syncing" ? "Syncing…" : "Sync to my account"}
              </Button>
              <Button variant="ghost" onClick={() => { handleClose(); onKeepLocal(); }} disabled={status === "syncing"} className="w-full">
                Keep local only
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
          <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Individual budgets
        </CardTitle>
        <CardDescription>Optional — a personal spending target per traveler.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add travelers first to set individual budgets.</p>
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
                      aria-label={`${p.name} budget`}
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
                    <p className={cn("text-[11px]", over ? "text-red-500 font-medium" : "text-muted-foreground")}>
                      Rp {formatCurrency(s)} of Rp {formatCurrency(budget)}
                      {over
                        ? ` · over by Rp ${formatCurrency(s - budget)}`
                        : ` · Rp ${formatCurrency(budget - s)} left`}
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
        setRateError(data.error ?? "Could not fetch rate. Enter manually.");
      } else {
        setFxRate(String(data.rate));
      }
    } catch {
      setRateError("Network error. Enter the rate manually.");
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
          <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Settle-up payments
        </CardTitle>
        <CardDescription>Record money paid directly between travelers (partial is fine).</CardDescription>
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
                <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-300">
                  {displayAmount(p)}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  aria-label="Delete payment"
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
                aria-label="Payer"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="touch-manipulation min-w-0 flex-1 h-11 sm:h-9 rounded-md border bg-background px-2 text-base sm:text-sm"
              >
                <option value="">From…</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ArrowRightLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              <select
                aria-label="Recipient"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="touch-manipulation min-w-0 flex-1 h-11 sm:h-9 rounded-md border bg-background px-2 text-base sm:text-sm"
              >
                <option value="">To…</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === from}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Currency + Amount. Note lives on its own row until sm: —
                three fields on one line leaves ~70px of typing space at 375px. */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Currency"
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
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
              <Input
                className="basis-full sm:basis-0 flex-1 h-11 text-base sm:h-9 sm:text-sm"
                placeholder="Note (optional)"
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
                    placeholder="rate in Rp"
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
                  Auto
                </Button>
              </div>
            )}
            {rateError && <p className="text-xs text-amber-600 dark:text-amber-400">{rateError}</p>}
            {isForeign && parseFloat(fxRate) > 0 && parseAmount(amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ Rp {formatCurrency(Math.round(parseAmount(amount) * parseFloat(fxRate)))}
              </p>
            )}

            <Button size="sm" className="touch-manipulation h-11 w-full gap-2" onClick={submit} disabled={!canSubmit}>
              <Plus className="h-4 w-4" />
              Record payment
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Add at least 2 travelers to record payments.</p>
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
        setInviteError("Couldn't load the invite link. Try again.");
      }
    } catch {
      setInviteError("Couldn't load the invite link — you may be offline.");
    } finally {
      setLoadingInvites(false);
    }
  }, [tripId, isOwner]);

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
        setInviteError("Couldn't create an invite link. Try again.");
      }
    } catch {
      setInviteError("Couldn't create an invite link — you may be offline.");
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
        setInviteError("Couldn't revoke the link — it is still active. Try again.");
        return;
      }
      setInvites((prev) => prev.filter((i) => i.token !== token));
      setConfirmRevoke(null);
      toast({ title: "Invite link revoked", variant: "success" });
    } catch {
      setInviteError("Couldn't revoke the link — it is still active. Try again.");
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
      toast({ title: "Link copied!", variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy the link",
        description: "Long-press the link above to copy it manually.",
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
          Members
        </CardTitle>
        <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
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
                    <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
              </div>
              {m.role === "owner" ? (
                <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Owner" />
              ) : null}
            </li>
          ))}
        </ul>

        {/* Invite section — owner only */}
        {isOwner && (
          <div className="pt-3 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Invite link
            </p>
            {loadingInvites ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
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
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="touch-manipulation flex-1 gap-1.5 text-xs text-green-700 dark:text-green-500"
                    onClick={() => shareLinkToWhatsApp(activeInvite.token)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                </div>
                {confirmRevoke === activeInvite.token ? (
                  <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
                    <p className="text-xs text-foreground/90">
                      Revoke this link? Anyone who has it will no longer be able
                      to join, and you will need to generate a new one.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="touch-manipulation flex-1 text-xs"
                        disabled={revoking}
                        onClick={() => void revokeInvite(activeInvite.token)}
                      >
                        {revoking ? "Revoking…" : "Yes, revoke"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="touch-manipulation flex-1 text-xs"
                        disabled={revoking}
                        onClick={() => setConfirmRevoke(null)}
                      >
                        Keep it
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
                    Revoke link
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
                Generate invite link
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
  // Warns when the browser has stopped accepting writes — full quota, or
  // storage blocked outright. Without this, a trip could gain receipts all day
  // and lose them on the next reload without a word.
  usePersistErrorToast(travel.persistError);
  const { dbUser, signOut } = useAuth();
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
    (id: string) => activeTrip?.participants.find((p) => p.id === id)?.name ?? "Someone",
    [activeTrip]
  );

  const handleSubmitProposal = useCallback(
    async (note?: string) => {
      if (!activeTrip) return false;
      const ok = await travel.submitChangeRequest(activeTrip.id, note);
      toast(
        ok
          ? { title: "Submitted for review", description: "The owner will approve or decline your changes.", variant: "success" }
          : { title: "Couldn't submit", description: "Please try again.", variant: "error" }
      );
      return ok;
    },
    [activeTrip, travel, toast]
  );

  const handleDiscardProposal = useCallback(() => {
    if (!activeTrip) return;
    travel.discardProposal(activeTrip.id);
    toast({ title: "Draft discarded" });
  }, [activeTrip, travel, toast]);

  const handleApprove = useCallback(
    async (crId: string) => {
      if (!activeTrip) return false;
      const ok = await travel.approveChangeRequest(activeTrip.id, crId);
      toast(
        ok
          ? { title: "Change approved", variant: "success" }
          : { title: "Couldn't approve", description: "The trip may have changed since — reload and retry.", variant: "error" }
      );
      return ok;
    },
    [activeTrip, travel, toast]
  );

  const handleDecline = useCallback(
    async (crId: string, note?: string) => {
      if (!activeTrip) return false;
      const ok = await travel.declineChangeRequest(activeTrip.id, crId, note);
      toast(ok ? { title: "Change declined" } : { title: "Couldn't decline", variant: "error" });
      return ok;
    },
    [activeTrip, travel, toast]
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
      title: "Trip deleted",
      description: removed?.name,
      variant: "success",
      duration: 6000,
      action: removed ? { label: "Undo", onClick: () => void travel.restoreTrip(removed) } : undefined,
    });
  };

  const openTrip = (id: string) => {
    setViewMode("overview");
    travel.setActiveId(id);
  };
  const closeTrip = () => travel.setActiveId(null);

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
      title: `${droppedIds.length} receipt${droppedIds.length > 1 ? "s" : ""} removed`,
      description: "They referenced the traveler you removed.",
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
  };

  const editReceipt = (id: string) => {
    const receipt = activeTrip?.receipts.find((r) => r.id === id);
    if (receipt) {
      setEditingReceipt({ receipt: { ...receipt }, isNew: false });
      setViewMode("edit-receipt");
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
        toast({ title: isNew ? "Receipt added" : "Receipt updated", description: receipt.title, variant: "success" });
        logFeatureUsage("travel", "receipt.added");
      } else {
        toast({
          title: "Couldn't save receipt",
          description: `${receipt.title} wasn't saved. Check your connection and retry.`,
          variant: "error",
          duration: 8000,
          action: { label: "Retry", onClick: () => submitReceipt(tripId, receipt, isNew) },
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
    submitReceipt(tripId, receipt, isNew);
  };

  const deleteReceipt = (id: string) => {
    if (!activeTrip) return;
    const tripId = activeTrip.id;
    const removed = activeTrip.receipts.find((r) => r.id === id);
    setDeleteReceiptId(null);
    void travel.deleteReceipt(tripId, id);
    toast({
      title: "Receipt deleted",
      description: removed?.title,
      variant: "success",
      duration: 6000,
      action: removed ? { label: "Undo", onClick: () => void travel.addReceipt(tripId, removed) } : undefined,
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
          title: "Already settled",
          description: `${nameOf(participantId)} has already settled up with ${nameOf(receipt.payerId)} — no extra payment recorded.`,
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
      title: "Payment recorded",
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
    toast({ title: "Trip archived", description: "Find it again via 'Show archived'.", variant: "success" });
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
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {activeTrip && viewMode !== "overview" ? (
            <button
              onClick={() => { setEditingReceipt(null); setViewMode("overview"); }}
              aria-label="Back to trip"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">Back to trip</span>
            </button>
          ) : activeTrip ? (
            <button
              onClick={closeTrip}
              aria-label="Back to all trips"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">All trips</span>
            </button>
          ) : (
            <Link href="/" aria-label="Back to home" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </Link>
          )}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Plane className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Travel Spend</span>
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
            <p className="text-muted-foreground">Loading your trips…</p>
          </div>
        ) : travel.cloudMode && travel.syncStatus === "conflict" ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <p className="flex-1 text-foreground/90">
              <span className="font-semibold text-red-700 dark:text-red-300">This trip is out of sync.</span>{" "}
              It may have changed on another device or tab, or a save didn&apos;t go through. Reload to get the
              latest — unsaved local changes will be discarded.
            </p>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => void travel.reloadCloud()}>
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        ) : travel.cloudMode && travel.syncStatus === "error" ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 text-foreground/90">
              <span className="font-semibold text-amber-700 dark:text-amber-300">Changes may not be saved.</span>{" "}
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
              <span className="font-semibold text-sky-700 dark:text-sky-300">Saved on this device.</span>{" "}
              You&apos;re offline — changes will sync to your account when you reconnect.
            </p>
          </div>
        ) : travel.cloudMode ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            {travel.syncStatus === "saving" || travel.pendingSync ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <p className="text-foreground/90">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {travel.syncStatus === "saving" || travel.pendingSync ? "Saving…" : "Saved to your account."}
              </span>{" "}
              {travel.syncStatus === "saving" || travel.pendingSync
                ? "Syncing your changes."
                : "Trips sync across devices automatically."}
            </p>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-foreground/90">
              <span className="font-semibold text-amber-700 dark:text-amber-300">Saved on this device only.</span>{" "}
              Sign in to sync trips across devices.
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
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Plan a group trip</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  Track shared expenses across countries, split every bill fairly,
                  and settle up in one tap at the end of the trip.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium">
                    <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Cloud sync
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium">
                    <Camera className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    AI receipt scan
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium">
                    <Globe className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    Multi-currency
                  </span>
                </div>
                <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Name your trip below to get started
                </p>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  New trip
                </CardTitle>
                <CardDescription>Start tracking receipts for a trip or event.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={newTripName}
                    onChange={(e) => setNewTripName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void createTrip()}
                    placeholder="e.g., Bali 2026"
                  />
                  <Button onClick={() => void createTrip()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create
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
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl border hover:bg-muted/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openTrip(t.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTrip(t.id); } }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{t.name}</p>
                          {hasForeignCurrency && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                              <Globe className="h-2.5 w-2.5" />
                              multi-currency
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t.participants.length} people · {(t.receipts ?? []).length} receipt(s)
                          {t.budget ? ` · budget Rp ${formatCurrency(t.budget)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-sm">Rp {formatCurrency(total)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${t.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTripId(t.id); }}
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
                    {archivedIds.size} archived trip{archivedIds.size > 1 ? "s" : ""}
                  </span>
                  <button
                    className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
                    onClick={() => {
                      const ids = [...archivedIds];
                      ids.forEach((id) => unarchiveTrip(id));
                    }}
                  >
                    Show all
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
                  <CardTitle>Trip details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trip name</Label>
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
                      Budget (optional)
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
                      <Label className="text-sm font-medium">Default receipt currency</Label>
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
                          New receipts will default to {activeTrip.defaultCurrency}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Travelers */}
              <Card>
                <CardHeader>
                  <CardTitle>Travelers</CardTitle>
                  <CardDescription>Everyone sharing expenses on this trip</CardDescription>
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
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Receipts</CardTitle>
                    <CardDescription>
                      {activeTrip.receipts.length} receipt{activeTrip.receipts.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                  <Button onClick={startNewReceipt} disabled={!canAddReceipt}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Receipt
                  </Button>
                </CardHeader>
                <CardContent>
                  {!canAddReceipt ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-primary opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">Add travelers first</p>
                      <p className="text-sm text-muted-foreground max-w-xs">Add at least 2 travelers to start adding receipts.</p>
                    </div>
                  ) : activeTrip.receipts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                        <ReceiptIcon className="h-6 w-6 text-accent opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">No receipts yet</p>
                      <p className="text-sm text-muted-foreground mb-4">Scan or add a receipt to start tracking.</p>
                      <Button size="sm" variant="secondary" onClick={startNewReceipt}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Receipt
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Tap a receipt to see its breakdown.</p>
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
                      <PartyPopper className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                      All settled up! 🎉
                    </h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                      {activeTrip.name} · {activeTrip.receipts.length} receipt{activeTrip.receipts.length !== 1 ? "s" : ""} ·{" "}
                      Rp {formatCurrency(tripTotals!.totalGrandTotal)} total
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center flex-wrap">
                    <Button variant="outline" className="border-emerald-300 dark:border-emerald-700" onClick={() => setViewMode("summary")}>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      View summary
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      onClick={() => archiveTrip(activeTrip.id)}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive trip
                    </Button>
                  </div>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 border-t border-emerald-200 dark:border-emerald-800 pt-3">
                    💼 <span className="font-medium">Pro:</span> Export PDF · Unlimited trip history · Budget analytics
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
                  Delete trip
                </Button>
              </div>
            </div>

            {/* Summary sidebar — compact */}
            <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
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
                <Button variant="outline" className="w-full" onClick={() => setViewMode("summary")}>
                  View summary
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
              <p className="text-sm text-muted-foreground">Full trip summary</p>
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
            onCancel={() => { setEditingReceipt(null); setViewMode("overview"); }}
            onUpdatePaymentInfo={(id, info) => void updateParticipantPaymentInfo(id, info)}
            isTravelMode
          />
        )}
      </div>

      {/* Confirm traveler removal when receipts would cascade-delete */}
      <Dialog open={pendingRemoval !== null} onOpenChange={(o) => !o && setPendingRemoval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove traveler?</DialogTitle>
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
            <Button variant="outline" onClick={() => setPendingRemoval(null)}>Cancel</Button>
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
            <DialogTitle>Delete this trip?</DialogTitle>
            <DialogDescription>
              The trip and all its receipts will be removed. You can undo this using the notification that appears.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTripId(null)}>Cancel</Button>
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
            <DialogTitle>Delete Receipt?</DialogTitle>
            <DialogDescription>
              The receipt will be removed. You can undo this using the notification that appears.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteReceiptId(null)}>Cancel</Button>
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
