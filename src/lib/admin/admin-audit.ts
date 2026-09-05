// Shared vocabulary for the admin audit trail (see the AdminAuditLog model).
// Both the API (which writes entries) and the admin UI (which renders the
// activity feed) import from here so the action slugs never drift apart.

export type AdminAuditAction =
  | "plan.change"
  | "quota.reset"
  | "quota.limit"
  | "user.ban"
  | "user.unban"
  | "role.grant"
  | "role.revoke"
  | "review.approve"
  | "review.reject";

export interface AdminAuditEntry {
  id: string;
  actorEmail: string;
  action: AdminAuditAction | string;
  targetEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Human-readable, one-line summary of an audit entry for the activity feed.
 * Kept pure (no JSX) so it can be unit-tested and reused anywhere.
 */
export function describeAuditEntry(entry: AdminAuditEntry): string {
  const m = entry.metadata ?? {};
  switch (entry.action) {
    case "plan.change":
      return `changed plan ${fmt(m.from)} → ${fmt(m.to)}`;
    case "quota.reset":
      return `reset AI-scan count${m.from != null ? ` (was ${fmt(m.from)})` : ""}`;
    case "quota.limit":
      return `set custom scan limit ${fmt(m.from)} → ${fmt(m.to)}`;
    case "user.ban":
      return "banned the account";
    case "user.unban":
      return "unbanned the account";
    case "role.grant":
      return "granted admin access";
    case "role.revoke":
      return "revoked admin access";
    case "review.approve":
      return `approved a ${fmt(m.rating)}-star review`;
    case "review.reject":
      return `rejected a ${fmt(m.rating)}-star review`;
    default:
      return entry.action;
  }
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "default";
  return String(v);
}
