"use client";

// UI for the member-approval workflow:
//   ChangeOpList  — renders a batch of ChangeOp as a human-readable diff.
//   ReviewInbox   — owner's queue of pending change requests (approve / decline).
//   ProposalBar   — member's local buffer status (submit / discard / declined note).

import { useState } from "react";
import { ChangeOp, TripChangeRequestDTO, TripProposal, describeChangeOp } from "@/lib/change-ops";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Clock, GitPullRequestArrow, AlertTriangle, PlusCircle, MinusCircle, PencilLine, Trash2 } from "@/components/ui/icons";
import { fill, useDictionary } from "@/lib/i18n/use-locale";

function money(amount?: number, currency?: string): string | null {
  if (amount == null) return null;
  if (currency && currency !== "IDR") return `${currency} ${amount.toLocaleString()}`;
  return formatCurrency(amount);
}

const TONE = {
  add: { dot: "text-success", Icon: PlusCircle },
  remove: { dot: "text-destructive", Icon: MinusCircle },
  edit: { dot: "text-warning", Icon: PencilLine },
} as const;

/** A batch of ops rendered as a readable list. */
export function ChangeOpList({
  ops,
  nameOf,
}: {
  ops: ChangeOp[];
  nameOf: (id: string) => string;
}) {
  return (
    <ul className="space-y-1.5">
      {ops.map((op, i) => {
        const d = describeChangeOp(op, nameOf);
        const { dot, Icon } = TONE[d.tone];
        const amount = money(d.amount, d.currency);
        return (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <Icon className={`h-4 w-4 shrink-0 ${dot}`} />
              <span className="font-medium shrink-0">{d.action}</span>
              <span className="text-muted-foreground truncate">{d.detail}</span>
            </span>
            {amount && <span className="tabular-nums text-muted-foreground shrink-0">{amount}</span>}
          </li>
        );
      })}
    </ul>
  );
}

// ── Owner: review inbox ──────────────────────────────────────────────────────

function ReviewItem({
  cr,
  tripVersion,
  nameOf,
  onApprove,
  onDecline,
}: {
  cr: TripChangeRequestDTO;
  tripVersion?: number;
  nameOf: (id: string) => string;
  onApprove: (crId: string) => Promise<boolean>;
  onDecline: (crId: string, note?: string) => Promise<boolean>;
}) {
  const t = useDictionary().app.review;
  const [busy, setBusy] = useState<null | "approve" | "decline">(null);
  const [showDecline, setShowDecline] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [note, setNote] = useState("");

  // The trip changed after this proposal was built — approval is last-write-wins,
  // so the owner should double-check it still makes sense.
  const stale = typeof tripVersion === "number" && cr.baseVersion !== tripVersion;

  const run = async (kind: "approve" | "decline") => {
    setBusy(kind);
    try {
      if (kind === "approve") await onApprove(cr.id);
      else await onDecline(cr.id, note.trim() || undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">{cr.authorName || t.aMember}</span>
          <span className="text-muted-foreground"> · {new Date(cr.createdAt).toLocaleString()}</span>
        </div>
        <Badge variant="secondary">{fill(t.changesCount, { count: cr.ops.length })}</Badge>
      </div>

      {cr.note && <p className="text-sm text-muted-foreground italic">“{cr.note}”</p>}

      <ChangeOpList ops={cr.ops} nameOf={nameOf} />

      {stale && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t.staleWarning}
        </p>
      )}

      {showDecline && (
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.declineReasonPlaceholder}
          rows={2}
        />
      )}

      {/* Approve merges someone else's edits into the shared trip, last write
          wins, with no undo anywhere in this UI — and it used to be one tap
          while Decline, which the member can simply revise and resubmit after,
          took two. The friction was on the reversible action. Now Approve
          confirms too, and the stale warning is repeated at the moment of
          commit rather than sitting further up the card. */}
      {confirmApprove && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-2">
          <p className="text-xs text-foreground/90">
            {stale
              ? t.confirmStale
              : t.confirmFresh}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void run("approve")} disabled={busy !== null}>
              <Check className="h-4 w-4 mr-1" />
              {busy === "approve" ? t.approving : t.approveYes}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmApprove(false)}
              disabled={busy !== null}
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {!confirmApprove && (
          <Button size="sm" onClick={() => setConfirmApprove(true)} disabled={busy !== null}>
            <Check className="h-4 w-4 mr-1" />
            {t.approve}
          </Button>
        )}
        {showDecline ? (
          <Button size="sm" variant="destructive" onClick={() => void run("decline")} disabled={busy !== null}>
            <X className="h-4 w-4 mr-1" />
            {busy === "decline" ? t.declining : t.declineConfirm}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowDecline(true)} disabled={busy !== null}>
            <X className="h-4 w-4 mr-1" />
            {t.decline}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Owner's queue of pending change requests. Renders nothing when empty. */
export function ReviewInbox({
  requests,
  tripVersion,
  nameOf,
  onApprove,
  onDecline,
}: {
  requests: TripChangeRequestDTO[];
  tripVersion?: number;
  nameOf: (id: string) => string;
  onApprove: (crId: string) => Promise<boolean>;
  onDecline: (crId: string, note?: string) => Promise<boolean>;
}) {
  const t = useDictionary().app.review;
  if (!requests || requests.length === 0) return null;
  return (
    <Card className="border-amber-300 dark:border-amber-700/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitPullRequestArrow className="h-5 w-5 text-warning" />
          {t.changesWaiting}
          <Badge variant="default">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((cr) => (
          <ReviewItem
            key={cr.id}
            cr={cr}
            tripVersion={tripVersion}
            nameOf={nameOf}
            onApprove={onApprove}
            onDecline={onDecline}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ── Member: proposal status bar ──────────────────────────────────────────────

/** The member's local edit buffer: submit for review, or discard. */
export function ProposalBar({
  proposal,
  nameOf,
  onSubmit,
  onDiscard,
}: {
  proposal: TripProposal | undefined;
  nameOf: (id: string) => string;
  onSubmit: (note?: string) => Promise<boolean>;
  onDiscard: () => void;
}) {
  const t = useDictionary().app.review;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  if (!proposal || proposal.ops.length === 0) return null;
  const submitted = proposal.status === "submitted";

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit(note.trim() || undefined);
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      className={
        submitted
          ? "border-blue-300 dark:border-blue-700/60"
          : "border-amber-300 dark:border-amber-700/60"
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {submitted ? (
            <>
              <Clock className="h-5 w-5 text-blue-500" />
              {t.waitingOwner}
            </>
          ) : (
            <>
              <GitPullRequestArrow className="h-5 w-5 text-warning" />
              {t.youHaveChanges}
            </>
          )}
          <Badge variant="secondary">{proposal.ops.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {proposal.reviewNote && !submitted && (
          <p className="flex items-start gap-1.5 text-sm text-destructive">
            <X className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{fill(t.ownerDeclined, { note: proposal.reviewNote ?? "" })}</span>
          </p>
        )}

        <ChangeOpList ops={proposal.ops} nameOf={nameOf} />

        {submitted ? (
          <p className="text-sm text-muted-foreground">
            {t.onlyVisibleToYou}
          </p>
        ) : (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
              rows={2}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void submit()} disabled={busy}>
                <Check className="h-4 w-4 mr-1" />
                {busy ? t.submitting : t.submit}
              </Button>
              <Button size="sm" variant="outline" onClick={onDiscard} disabled={busy}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t.discard}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
