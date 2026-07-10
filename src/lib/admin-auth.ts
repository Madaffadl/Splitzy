// Email addresses with admin access to /admin and /api/admin/*.
// Add more emails here to grant access.
const ADMIN_EMAILS = new Set(["m.daffafadhil26@gmail.com"]);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase().trim());
}
