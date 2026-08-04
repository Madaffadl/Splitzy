// Transactional email (Sprint 5), backed by Resend's REST API — no SDK, so no
// dependency and it runs on any runtime. Completely inert until RESEND_API_KEY
// is set: sendEmail returns false and sends nothing, so callers stay safe.
import { BRAND } from "@/lib/brand";

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || `Splitzy <onboarding@splitzy.my.id>`;

export function isEmailConfigured(): boolean {
  return Boolean(API_KEY);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!API_KEY) return false; // inert until configured
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, reply_to: "adminsplitzy@gmail.com" }),
    });
    if (!res.ok) {
      console.error("Email send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

/** One-time welcome sent on first sign-in. No-op when email isn't configured. */
export async function sendWelcomeEmail(to: string, name: string | null): Promise<void> {
  if (!isEmailConfigured() || !to) return;
  const first = name?.trim().split(" ")[0] || "there";
  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
    <h1 style="font-size:20px">Welcome to Splitzy, ${first} 👋</h1>
    <p style="color:#555;line-height:1.6">
      Thanks for signing up. Splitzy helps you split dining and travel bills
      fairly with friends — and figure out who owes what with the fewest
      transfers.
    </p>
    <p style="color:#555;line-height:1.6">Ready when you are:</p>
    <p>
      <a href="${BRAND.siteUrl}/single"
         style="display:inline-block;background:#3a4a1f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">
        Split a bill
      </a>
    </p>
    <p style="color:#999;font-size:12px;margin-top:32px">
      You're receiving this because you created a Splitzy account. Questions?
      Reply to <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a>.
    </p>
  </div>`;
  await sendEmail({ to, subject: "Welcome to Splitzy 👋", html });
}
