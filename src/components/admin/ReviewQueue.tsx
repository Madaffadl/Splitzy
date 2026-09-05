"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Star, Check, X } from "@/components/ui/icons";
import { StarRatingDisplay } from "@/components/reviews/StarRatingInput";
import { cn } from "@/lib/utils";

// Copy here is hardcoded English on purpose: the whole admin panel is
// deliberately untranslated, and adding dictionary keys for one card would
// leave the surrounding chrome inconsistent.

interface AdminReview {
  id: string;
  rating: number;
  body: string | null;
  displayName: string | null;
  userName: string | null;
  userEmail: string;
  source: string;
  locale: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

type StatusTab = "pending" | "approved" | "rejected" | "all";

const TABS: { key: StatusTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function ReviewQueue({ onModerated }: { onModerated: () => void }) {
  const [tab, setTab] = useState<StatusTab>("pending");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which row has its reject box open, and what's typed in it.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(
    async (cursor: string | null = null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: tab });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/admin/reviews?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          reviews: AdminReview[];
          nextCursor: string | null;
          stats: typeof stats;
        };
        setReviews((prev) => (cursor ? [...prev, ...data.reviews] : data.reviews));
        setNextCursor(data.nextCursor);
        setStats(data.stats);
      } catch {
        setError("Couldn't load reviews.");
      } finally {
        setLoading(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  async function moderate(id: string, action: "approve" | "reject", note?: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote: note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      const nextStatus = action === "approve" ? "approved" : "rejected";
      // Drop the row when it no longer belongs in the open tab; otherwise
      // update it in place. Same optimistic technique as the users table.
      setReviews((prev) =>
        tab === "all"
          ? prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r))
          : prev.filter((r) => r.id !== id)
      );
      setStats((prev) => {
        const moved = reviews.find((r) => r.id === id);
        if (!moved) return prev;
        const next = { ...prev };
        if (moved.status in next) next[moved.status as keyof typeof next] -= 1;
        next[nextStatus as keyof typeof next] += 1;
        return next;
      });
      setRejecting(null);
      setRejectNote("");
      onModerated();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Star weight="fill" className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Review moderation</CardTitle>
        </div>
        <CardDescription>
          Nothing a user writes reaches a public surface until it is approved here.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TABS.map((tb) => {
            const count =
              tb.key === "all" ? undefined : stats[tb.key as keyof typeof stats];
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === tb.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {tb.label}
                {count !== undefined && count > 0 && ` (${count})`}
              </button>
            );
          })}
        </div>

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        {loading && reviews.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {tab === "pending" ? "Nothing waiting for review." : `No ${tab} reviews.`}
          </p>
        ) : (
          <ul className="divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="py-4 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StarRatingDisplay
                    value={r.rating}
                    label={`${r.rating} out of 5 stars`}
                  />
                  <span className="text-sm font-medium">
                    {r.displayName ?? r.userName ?? r.userEmail}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.userEmail}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {r.source}
                  </span>
                  {tab === "all" && (
                    <span className="text-xs text-muted-foreground">{r.status}</span>
                  )}
                </div>

                {/* Flag a drifted snapshot: the name that would be published is
                    not the name on the account any more. */}
                {r.displayName && r.userName && r.displayName !== r.userName && (
                  <p className="text-xs text-muted-foreground">
                    Name has changed since submitting — now &ldquo;{r.userName}&rdquo;
                  </p>
                )}

                {r.body ? (
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{r.body}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">Rating only</p>
                )}

                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                {rejecting === r.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Optional note — the author sees this."
                      rows={2}
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === r.id}
                        onClick={() => moderate(r.id, "reject", rejectNote)}
                      >
                        Confirm reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRejecting(null);
                          setRejectNote("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {r.status !== "approved" && (
                      <Button
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => moderate(r.id, "approve")}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === r.id}
                        onClick={() => {
                          setRejecting(r.id);
                          setRejectNote("");
                        }}
                      >
                        <X className="mr-1 h-4 w-4" />
                        {r.status === "approved" ? "Take down" : "Reject"}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void load(nextCursor)}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
