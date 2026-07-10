"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TravelTrip, Receipt, Participant, PaymentInfo, TripMember } from "@/types";
import { useTravelData } from "@/hooks/useTravelData";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
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
    await travel.deleteTrip(id);
    setDeleteTripId(null);
    toast({ title: "Trip deleted", variant: "success" });
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
    const removed = activeTrip.receipts.find((r) => r.id === id);
    await travel.deleteReceipt(activeTrip.id, id);
    setDeleteReceiptId(null);
    toast({ title: "Receipt deleted", description: removed?.title, variant: "success" });
  };

  // Mark a whole receipt as already settled (or undo). Settled receipts still
  // count toward Total Spent / Budget but drop out of the final settlement.
  const toggleSettled = async (receipt: Receipt) => {
    if (!activeTrip) return;
    const next = !receipt.settled;
    await travel.updateReceipt(activeTrip.id, { ...receipt, settled: next });
    toast({
      title: next ? "Marked as paid" : "Marked as unpaid",
      description: next
        ? `${receipt.title} is excluded from the settlement.`
        : `${receipt.title} is back in the settlement.`,
      variant: "success",
    });
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
        ) : travel.cloudMode ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-foreground/90">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">Saved to your account.</span>{" "}
              Trips sync across devices automatically.
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
                          onToggleSettled={() => void toggleSettled(r)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

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
                onUpdatePaymentInfo={(id, info) => void updateParticipantPaymentInfo(id, info)}
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
