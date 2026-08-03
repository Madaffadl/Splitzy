// Minimal Xendit Invoice API client (Sprint 2). No SDK — one fetch call — so it
// runs on any runtime and adds no dependency. Fully inert until XENDIT_SECRET_KEY
// is set; callers must check isXenditConfigured() first.
//
// Xendit auth is HTTP Basic with the secret key as the username and an empty
// password. Webhooks are verified out-of-band via the x-callback-token header
// (see verifyWebhookToken), which Xendit sets to XENDIT_WEBHOOK_TOKEN.

const SECRET_KEY = process.env.XENDIT_SECRET_KEY;
const WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN;
const API_BASE = "https://api.xendit.co";

/** True when the Xendit secret key is configured (checkout can run). */
export function isXenditConfigured(): boolean {
  return Boolean(SECRET_KEY);
}

/** True when the webhook verification token is configured. */
export function isXenditWebhookConfigured(): boolean {
  return Boolean(WEBHOOK_TOKEN);
}

/** Constant-time-ish equality check for the incoming webhook callback token. */
export function verifyWebhookToken(token: string | null | undefined): boolean {
  if (!WEBHOOK_TOKEN || !token) return false;
  return token === WEBHOOK_TOKEN;
}

export interface CreateInvoiceInput {
  externalId: string;
  amount: number;
  payerEmail?: string;
  description: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  /** Invoice lifetime in seconds (default 24h). */
  durationSeconds?: number;
}

export interface XenditInvoice {
  id: string;
  invoiceUrl: string;
  status: string;
}

/**
 * Create a hosted Xendit invoice and return its id + payment URL. Throws if the
 * key is missing or Xendit responds with an error — the caller surfaces that as
 * a 500 and does not leave a dangling "paid" state.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<XenditInvoice> {
  if (!SECRET_KEY) {
    throw new Error("Xendit is not configured (XENDIT_SECRET_KEY missing)");
  }

  const auth = Buffer.from(`${SECRET_KEY}:`).toString("base64");
  const res = await fetch(`${API_BASE}/v2/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      external_id: input.externalId,
      amount: input.amount,
      currency: "IDR",
      description: input.description,
      payer_email: input.payerEmail,
      success_redirect_url: input.successRedirectUrl,
      failure_redirect_url: input.failureRedirectUrl,
      invoice_duration: input.durationSeconds ?? 24 * 60 * 60,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Xendit invoice creation failed: HTTP ${res.status} ${detail}`);
  }

  const data = (await res.json()) as { id: string; invoice_url: string; status: string };
  return { id: data.id, invoiceUrl: data.invoice_url, status: data.status };
}
