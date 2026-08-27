// Admin access is driven by the `role` column on User ("admin" vs "user"),
// manageable at runtime from the admin dashboard.
//
// A bootstrap allowlist (env ADMIN_BOOTSTRAP_EMAILS, comma-separated) is ALWAYS
// treated as admin regardless of the DB role. This is a deliberate lockout
// guard: it seeds the very first admin and lets an operator recover access by
// setting an env var if the role data ever gets lost.
//
// SECURITY: the allowlist comes ONLY from the environment — no email is baked
// into source. When the env var is unset the set is empty and admin access
// falls back entirely to the DB `role` column. Set ADMIN_BOOTSTRAP_EMAILS in
// each deploy environment BEFORE relying on it (see .env.example).
const BOOTSTRAP_ADMIN_EMAILS = new Set(
  (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
    .split(",")
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean)
);

/** True if this email is a hardcoded/bootstrap admin (can't be revoked via UI). */
export function isBootstrapAdmin(email: string): boolean {
  return BOOTSTRAP_ADMIN_EMAILS.has(email.toLowerCase().trim());
}

/** Effective admin check: DB role OR bootstrap email. */
export function isAdmin(user: { email: string; role?: string | null }): boolean {
  return user.role === "admin" || isBootstrapAdmin(user.email);
}
