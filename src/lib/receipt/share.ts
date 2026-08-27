// Encode/decode a receipt+participants payload into a URL-safe base64 string
// for sharing via link. The encoded payload lives in the URL hash so it's
// never sent to the server — purely client-side, no DB writes, works for
// guests. Maximum practical URL length is ~8KB which comfortably fits a
// dinner-sized receipt (~5 items, 4 people = ~700 bytes encoded).
//
// Versioned so we can evolve the shape later without breaking old links.

import type { Receipt, Participant } from "@/types";

const PAYLOAD_VERSION = 1;
// Hard cap to protect the share viewer from junk URLs and trivially large
// payloads. ~8KB encoded == roughly 6KB JSON, plenty for a typical receipt.
const MAX_ENCODED_LENGTH = 8000;

export interface SharePayload {
  v: typeof PAYLOAD_VERSION;
  title: string;
  receipt: Receipt;
  participants: Participant[];
}

function toUrlSafeBase64(s: string): string {
  // Use btoa with UTF-8 bytes so non-ASCII names don't break it.
  const utf8 = new TextEncoder().encode(s);
  let binary = "";
  for (const byte of utf8) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromUrlSafeBase64(s: string): string {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  // atob handles missing padding inconsistently across browsers — pad explicitly.
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShare(payload: Omit<SharePayload, "v">): string {
  const body: SharePayload = { v: PAYLOAD_VERSION, ...payload };
  const encoded = toUrlSafeBase64(JSON.stringify(body));
  if (encoded.length > MAX_ENCODED_LENGTH) {
    throw new Error(
      "This split is too large to share via link. Try splitting it into smaller receipts."
    );
  }
  return encoded;
}

export function decodeShare(encoded: string): SharePayload | null {
  if (!encoded || encoded.length > MAX_ENCODED_LENGTH) return null;
  try {
    const json = fromUrlSafeBase64(encoded);
    const parsed = JSON.parse(json) as SharePayload;

    // Shape validation — defend against malformed or downgraded payloads.
    if (parsed?.v !== PAYLOAD_VERSION) return null;
    if (!parsed.receipt || typeof parsed.receipt.title !== "string") return null;
    if (!Array.isArray(parsed.receipt.items)) return null;
    if (!Array.isArray(parsed.participants)) return null;
    if (typeof parsed.receipt.tax !== "number") return null;
    if (typeof parsed.receipt.service !== "number") return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build a fully-qualified share URL. Use the hash (#) so the payload is never
 * sent to the server.
 */
export function buildShareUrl(origin: string, encoded: string): string {
  return `${origin.replace(/\/$/, "")}/share#${encoded}`;
}
