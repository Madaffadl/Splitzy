"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { TravelTrip, Receipt, Participant, PaymentInfo, TripMember, TripPayment } from "@/types";
import { useTravelData } from "@/hooks/useTravelData";
import { useAuth } from "@/hooks/useAuth";
import { calculatePersonTotals } from "@/lib/calculations";
import { findSharePayment, paidShareParticipants, sharePaymentSource } from "@/lib/settle-up";
import { formatCurrency, cn } from "@/lib/utils";
import { generateId } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { ParticipantManager } from "@/components/ParticipantManager";
import { ReceiptEditor } from "@/components/ReceiptEditor";
import { MultipleReceiptSummaryPanel, ReceiptBreakdown } from "@/components/SummaryPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  X,
  Crown,
  UserPlus,
  Wallet,
  ArrowRightLeft,
  RefreshCw,
  AlertTriangle,
  CloudOff,
} from "lucide-react";
import { AppFooter } from "@/components/AppFooter";

type ViewMode = "overview" | "edit-receipt" | "summary";

interface EditingReceipt {
  receipt: Receipt;
  isNew: boolean;
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
}: {
  open: boolean;
  onSync: () => Promise<number>;
  onDismiss: () => void;
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
              <Button variant="ghost" onClick={handleClose} disabled={status === "syncing"} className="w-full">
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
    setDrafts((prev) => {
      if (!(id in prev)) return prev;
      const val = parseAmount(prev[id]);
      onSetBudget(id, val > 0 ? val : undefined);
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
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">Rp</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="pl-8 h-8 text-sm"
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
  onAdd,
  onDelete,
}: {
  participants: Participant[];
  payments: TripPayment[];
  onAdd: (input: { from: string; to: string; amount: number; note?: string }) => void;
  onDelete: (paymentId: string) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Unknown";

  const submit = () => {
    const value = parseAmount(amount);
    if (!from || !to || from === to || value <= 0) return;
    onAdd({ from, to, amount: value, note: note.trim() || undefined });
    setAmount("");
    setNote("");
  };

  const canSubmit = from && to && from !== to && parseAmount(amount) > 0;

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
                  Rp {formatCurrency(p.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  aria-label="Delete payment"
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
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
            <div className="flex items-center gap-2">
              <select
                aria-label="Payer"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
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
                className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">To…</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === from}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">Rp</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="pl-8 h-9"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
              <Input
                className="flex-1 h-9"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
            <Button size="sm" className="w-full gap-2" onClick={submit} disabled={!canSubmit}>
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

  const fetchInvites = useCallback(async () => {
    if (!isOwner) return;
    setLoadingInvites(true);
    try {
      const res = await fetch(`/api/travel/${tripId}/invites`);
      if (res.ok) {
        const { invites: list } = (await res.json()) as { invites: InviteInfo[] };
        setInvites(list);
      }
    } finally {
      setLoadingInvites(false);
    }
  }, [tripId, isOwner]);

  useEffect(() => { void fetchInvites(); }, [fetchInvites]);

  const generateInvite = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/travel/${tripId}/invites`, { method: "POST" });
      if (res.ok) {
        const inv = (await res.json()) as InviteInfo;
        setInvites((prev) => [inv, ...prev]);
      }
    } finally {
      setGenerating(false);
    }
  };

  const revokeInvite = async (token: string) => {
    await fetch(`/api/travel/${tripId}/invites/${token}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.token !== token));
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link copied!", variant: "success" });
    setTimeout(() => setCopied(false), 2000);
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
                <img src={m.avatarUrl} alt={m.name ?? m.email} className="h-7 w-7 rounded-full object-cover" />
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
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/invite/${activeInvite.token}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(activeInvite.expiresAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 gap-1.5 text-xs h-7"
                    onClick={() => void copyLink(activeInvite.token)}
                  >
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive"
                    onClick={() => void revokeInvite(activeInvite.token)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 text-xs h-8"
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function TravelPage() {
  const travel = useTravelData();
  const { dbUser } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [editingReceipt, setEditingReceipt] = useState<EditingReceipt | null>(null);
  const [newTripName, setNewTripName] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null);
  const [deleteReceiptId, setDeleteReceiptId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const trips = travel.trips ?? [];
  const rawActive = trips.find((t) => t.id === travel.activeId) ?? null;
  const activeTrip: TravelTrip | null = rawActive
    ? { ...rawActive, participants: rawActive.participants ?? [], receipts: rawActive.receipts ?? [] }
    : null;

  useEffect(() => {
    if (viewMode !== "overview") window.scrollTo({ top: 0, behavior: "instant" });
  }, [viewMode]);

  // ── Trip CRUD ─────────────────────────────────────────────────────────────
  const createTrip = async () => {
    const name = newTripName.trim() || "My Trip";
    await travel.createTrip(name);
    setNewTripName("");
  };

  const deleteTrip = async (id: string) => {
    const removed = trips.find((t) => t.id === id);
    await travel.deleteTrip(id);
    setDeleteTripId(null);
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
    await travel.updateParticipants(activeTrip.id, participants, receipts);
    if (dropped > 0) {
      toast({
        title: `${dropped} receipt${dropped > 1 ? "s" : ""} removed`,
        description: "They referenced a traveler you removed.",
        variant: "success",
      });
    }
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
      for (const share of calculatePersonTotals(receipt, ids)) {
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
    const receipt: Receipt = {
      id: generateId(),
      title: `Receipt ${activeTrip.receipts.length + 1}`,
      payerId: activeTrip.participants[0]?.id || "",
      items: [],
      tax: 0,
      service: 0,
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

  const saveReceipt = async () => {
    if (!activeTrip || !editingReceipt || isSaving) return;
    setIsSaving(true);
    const { receipt, isNew } = editingReceipt;
    if (isNew) {
      await travel.addReceipt(activeTrip.id, receipt);
    } else {
      await travel.updateReceipt(activeTrip.id, receipt);
    }
    setEditingReceipt(null);
    setViewMode("overview");
    toast({ title: isNew ? "Receipt added" : "Receipt updated", description: receipt.title, variant: "success" });
    setTimeout(() => setIsSaving(false), 0);
  };

  const deleteReceipt = async (id: string) => {
    if (!activeTrip) return;
    const tripId = activeTrip.id;
    const removed = activeTrip.receipts.find((r) => r.id === id);
    await travel.deleteReceipt(tripId, id);
    setDeleteReceiptId(null);
    toast({
      title: "Receipt deleted",
      description: removed?.title,
      variant: "success",
      duration: 6000,
      action: removed ? { label: "Undo", onClick: () => void travel.addReceipt(tripId, removed) } : undefined,
    });
  };

  // Effective share of a receipt for one participant (used to size the payment
  // recorded when their share is marked paid).
  const shareOf = (receipt: Receipt, participantId: string): number => {
    const ids = (activeTrip?.participants ?? []).map((p) => p.id);
    return calculatePersonTotals(receipt, ids).find((s) => s.participantId === participantId)?.total ?? 0;
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
      const amount = shareOf(receipt, participantId);
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
    const paidSet = paidShareParticipants(activeTrip.payments, receiptId);
    const allPaid = owing.length > 0 && owing.every((p) => paidSet.has(p.id));
    for (const p of owing) {
      const existing = findSharePayment(activeTrip.payments, receiptId, p.id);
      if (allPaid && existing) {
        void travel.deletePayment(activeTrip.id, existing.id);
      } else if (!allPaid && !existing) {
        void travel.addPayment(activeTrip.id, {
          from: p.id,
          to: receipt.payerId,
          amount: p.amount,
          source: sharePaymentSource(receiptId, p.id),
        });
      }
    }
  };

  // Record / remove a direct settle-up payment between two travelers.
  const addSettleUp = (input: { from: string; to: string; amount: number; note?: string; source?: string }) => {
    if (!activeTrip) return;
    void travel.addPayment(activeTrip.id, input);
    const nameOf = (id: string) => activeTrip.participants.find((p) => p.id === id)?.name ?? "?";
    toast({
      title: "Payment recorded",
      description: `${nameOf(input.from)} → ${nameOf(input.to)}: Rp ${formatCurrency(input.amount)}`,
      variant: "success",
    });
  };
  const deleteSettleUp = (paymentId: string) => {
    if (!activeTrip) return;
    void travel.deletePayment(activeTrip.id, paymentId);
  };

  const canAddReceipt = (activeTrip?.participants.length ?? 0) >= 2;

  // ── Trip name sync on blur ────────────────────────────────────────────────
  const commitName = async () => {
    if (nameDraft !== null && activeTrip) {
      await travel.updateTrip(activeTrip.id, { name: nameDraft.trim() || "My Trip" });
      setNameDraft(null);
    }
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
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">All trips</span>
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
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
              <span className="font-semibold text-red-700 dark:text-red-300">This trip changed elsewhere.</span>{" "}
              Reload to get the latest — unsaved local changes will be discarded.
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
        ) : travel.cloudMode ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            {travel.syncStatus === "saving" ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <p className="text-foreground/90">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {travel.syncStatus === "saving" ? "Saving…" : "Saved to your account."}
              </span>{" "}
              {travel.syncStatus === "saving" ? "Syncing your changes." : "Trips sync across devices automatically."}
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

            {trips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Plane className="h-6 w-6 text-emerald-600 dark:text-emerald-400 opacity-80" />
                </div>
                <p className="font-semibold text-foreground mb-1">No trips yet</p>
                <p className="text-sm text-muted-foreground max-w-sm">Create your first trip above to start tracking expenses.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {trips.map((t) => {
                  const total = (t.receipts ?? []).reduce(
                    (s, r) => s + r.items.reduce((x, i) => x + i.total, 0) + r.tax + r.service,
                    0
                  );
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl border hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => openTrip(t.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{t.name}</p>
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
            )}
          </div>
        )}

        {/* ── Trip workspace: overview ── */}
        {activeTrip && viewMode === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Trip details + budget */}
              <Card>
                <CardHeader>
                  <CardTitle>Trip details</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
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
                          paidParticipantIds={paidShareParticipants(activeTrip.payments, r.id)}
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
                payments={activeTrip.payments ?? []}
                onAdd={addSettleUp}
                onDelete={deleteSettleUp}
              />

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
            <div className="space-y-3">
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
            onSave={() => void saveReceipt()}
            onCancel={() => { setEditingReceipt(null); setViewMode("overview"); }}
            isSaving={isSaving}
            onUpdatePaymentInfo={(id, info) => void updateParticipantPaymentInfo(id, info)}
          />
        )}
      </div>

      {/* Delete trip confirm */}
      <Dialog open={deleteTripId !== null} onOpenChange={() => setDeleteTripId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this trip?</DialogTitle>
            <DialogDescription>
              This permanently removes the trip and all its receipts. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTripId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTripId && void deleteTrip(deleteTripId)}>
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
              Are you sure you want to delete this receipt? This action cannot be undone.
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
      />

      <AppFooter />
    </main>
  );
}
