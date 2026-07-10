"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { FREE_SCAN_LIMIT } from "@/lib/scan-quota";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { AppFooter } from "@/components/AppFooter";
import {
  Shield,
  Loader2,
  RefreshCw,
  RotateCcw,
  Users,
  Scan,
  ArrowLeft,
  X,
  Ban,
  CheckCircle2,
  Search,
  Plane,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  aiScanCount: number;
  aiScanResetAt: string | null;
  aiScanLimit: number | null;
  bannedAt: string | null;
  tripCount: number;
  createdAt: string;
}

interface AdminTrip {
  id: string;
  name: string;
  budget: number | null;
  receiptCount: number;
  createdAt: string;
  updatedAt: string;
}

type PlanFilter = "all" | "free" | "pro" | "banned";

// ── Small helpers ───────────────────────────────────────────────────────────
function PlanBadge({ user }: { user: AdminUser }) {
  if (user.bannedAt) return <Badge variant="destructive">Banned</Badge>;
  if (user.plan === "pro")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
        Pro
      </Badge>
    );
  return <Badge variant="secondary">Free</Badge>;
}

function ScanBar({ user }: { user: AdminUser }) {
  if (user.plan === "pro") return <span className="text-sm text-muted-foreground">∞</span>;
  const limit = user.aiScanLimit ?? FREE_SCAN_LIMIT;
  const pct = Math.min(100, (user.aiScanCount / limit) * 100);
  const over = user.aiScanCount >= limit;
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums whitespace-nowrap ${over ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
        {user.aiScanCount}/{user.aiScanLimit ?? FREE_SCAN_LIMIT}
        {user.aiScanLimit !== null && user.aiScanLimit !== FREE_SCAN_LIMIT && (
          <span className="text-primary ml-0.5">*</span>
        )}
      </span>
    </div>
  );
}

function Avatar({ user, size = "sm" }: { user: AdminUser; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-12 w-12 text-lg" : "h-7 w-7 text-xs";
  return user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatarUrl} alt={user.name ?? user.email} className={`${cls} rounded-full shrink-0`} />
  ) : (
    <div className={`${cls} rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary uppercase`}>
      {(user.name ?? user.email)[0]}
    </div>
  );
}

// ── User Drawer ─────────────────────────────────────────────────────────────
function UserDrawer({
  user,
  onClose,
  onUpdate,
}: {
  user: AdminUser;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [limitDraft, setLimitDraft] = useState<string>(
    user.aiScanLimit !== null ? String(user.aiScanLimit) : ""
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/admin/users/${user.id}/trips`)
      .then((r) => (r.ok ? r.json() : { trips: [] }))
      .then((d: { trips: AdminTrip[] }) => setTrips(d.trips))
      .finally(() => setTripsLoading(false));
  }, [user.id]);

  const patch = useCallback(
    async (body: Record<string, unknown>, msg: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          setSuccessMsg(msg);
          setTimeout(() => setSuccessMsg(null), 2500);
          onUpdate();
        }
      } finally {
        setBusy(false);
      }
    },
    [user.id, onUpdate]
  );

  const applyLimit = () => {
    const val = limitDraft.trim();
    const num = val === "" ? null : parseInt(val, 10);
    if (val !== "" && (isNaN(num!) || num! < 0 || num! > 10000)) return;
    void patch({ aiScanLimit: num }, "Custom limit saved");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold">User details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Success toast */}
          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMsg}
            </div>
          )}

          {/* Identity */}
          <div className="flex items-center gap-3">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              {user.name && <p className="font-semibold truncate">{user.name}</p>}
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                Joined {new Date(user.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Ban warning */}
          {user.bannedAt && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Account suspended</p>
                <p className="text-xs opacity-80">
                  Banned on {new Date(user.bannedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          )}

          {/* Plan */}
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Plan</p>
                <p className="text-xs text-muted-foreground">Current subscription tier</p>
              </div>
              <PlanBadge user={user} />
            </div>
            <div className="flex gap-2">
              <Button
                variant={user.plan === "free" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                disabled={busy || user.plan === "free"}
                onClick={() => void patch({ plan: "free" }, "Plan set to Free")}
              >
                Free
              </Button>
              <Button
                variant={user.plan === "pro" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                disabled={busy || user.plan === "pro"}
                onClick={() => void patch({ plan: "pro" }, "Plan set to Pro ✨")}
              >
                Pro ✨
              </Button>
            </div>
          </div>

          {/* Scan quota */}
          <div className="rounded-xl border p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">AI Scan Quota</p>
              <p className="text-xs text-muted-foreground">Monthly usage and limits</p>
            </div>
            <div className="flex items-center gap-3">
              <ScanBar user={user} />
              {user.aiScanResetAt && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Resets {new Date(user.aiScanResetAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Custom limit (blank = plan default)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10000"
                  placeholder={`${FREE_SCAN_LIMIT} (default)`}
                  value={limitDraft}
                  onChange={(e) => setLimitDraft(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-5 h-8"
                disabled={busy}
                onClick={applyLimit}
              >
                Save
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={busy || user.aiScanCount === 0}
              onClick={() => void patch({ resetQuota: true }, "Quota reset to 0")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset this month&apos;s count
            </Button>
          </div>

          {/* Trips */}
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Trips</p>
                <p className="text-xs text-muted-foreground">{user.tripCount} total owned</p>
              </div>
              <Plane className="h-4 w-4 text-emerald-500" />
            </div>
            {tripsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : trips.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No trips yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {trips.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.receiptCount} receipt{t.receiptCount !== 1 ? "s" : ""}
                        {t.budget ? ` · Rp ${formatCurrency(t.budget)}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {new Date(t.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-destructive/30 p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">Danger zone</p>
            {user.bannedAt ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                disabled={busy}
                onClick={() => void patch({ ban: false }, "User unbanned")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Unban user
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={busy}
                onClick={() => void patch({ ban: true }, "User banned")}
              >
                <Ban className="h-4 w-4" />
                Ban / Suspend user
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Banned users cannot sign in or access any feature.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403 || res.status === 401) {
        router.replace("/");
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { users: AdminUser[] };
      setUsers(data.users);
      // Refresh selected user data from new list
      if (selectedUser) {
        const updated = data.users.find((u) => u.id === selectedUser.id);
        setSelectedUser(updated ?? null);
      }
    } catch {
      setError("Failed to load users. Try refreshing.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!authLoading) void fetchUsers();
  }, [authLoading, fetchUsers]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q);
      const matchesPlan =
        planFilter === "all" ||
        (planFilter === "banned" && !!u.bannedAt) ||
        (planFilter !== "banned" && !u.bannedAt && u.plan === planFilter);
      return matchesSearch && matchesPlan;
    });
  }, [users, search, planFilter]);

  const totalUsers = users.length;
  const proUsers = users.filter((u) => u.plan === "pro" && !u.bannedAt).length;
  const bannedUsers = users.filter((u) => !!u.bannedAt).length;
  const totalScans = users.reduce((s, u) => s + u.aiScanCount, 0);

  const filterTabs: { key: PlanFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "free", label: "Free" },
    { key: "pro", label: "Pro" },
    { key: "banned", label: "Banned" },
  ];

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b glass sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline text-sm font-medium">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-violet-500 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 flex-grow w-full space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Total users", value: totalUsers, color: "bg-primary/10 text-primary" },
            { icon: Shield, label: "Pro accounts", value: proUsers, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
            { icon: Ban, label: "Banned", value: bannedUsers, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
            { icon: Scan, label: "Scans (month)", value: totalScans, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Click a row to manage access</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void fetchUsers()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1 rounded-lg border p-1 bg-muted/30 self-start">
                {filterTabs.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPlanFilter(key)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      planFilter === key
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                    {key !== "all" && (
                      <span className="ml-1.5 text-xs opacity-60">
                        {key === "banned"
                          ? bannedUsers
                          : key === "pro"
                          ? proUsers
                          : users.filter((u) => !u.bannedAt && u.plan === "free").length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive text-sm">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {search || planFilter !== "all" ? "No users match your filter." : "No users yet."}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">User</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Plan</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Scans</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground hidden sm:table-cell">Trips</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                      <th className="py-2 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedUser(u)}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar user={u} />
                            <div className="min-w-0">
                              {u.name && <p className="font-medium truncate">{u.name}</p>}
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <PlanBadge user={u} />
                        </td>
                        <td className="py-3 px-2">
                          <ScanBar user={u} />
                        </td>
                        <td className="py-3 px-2 hidden sm:table-cell text-muted-foreground">
                          {u.tripCount}
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell text-muted-foreground text-xs">
                          {new Date(u.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User detail drawer */}
      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdate={() => void fetchUsers()}
        />
      )}

      <AppFooter />
    </main>
  );
}
