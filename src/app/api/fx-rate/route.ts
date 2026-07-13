import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

// In-memory cache: rate entries expire after 1 hour.
// This avoids hammering the external API on every receipt edit.
interface CacheEntry { rate: number; updatedAt: string; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

const MAX_CURRENCY_CODE = 10;
// ISO 4217 — only letters
const CURRENCY_RE = /^[A-Z]{2,10}$/;

// GET /api/fx-rate?from=VND
// Returns { rate: number, currency: string, updatedAt: string }
// rate = how many IDR per 1 unit of `from`
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("from") ?? "").toUpperCase().trim().slice(0, MAX_CURRENCY_CODE);

  if (!raw || raw === "IDR") {
    return NextResponse.json({ rate: 1, currency: "IDR", updatedAt: new Date().toISOString() });
  }
  if (!CURRENCY_RE.test(raw)) {
    return apiError("BAD_REQUEST", "Invalid currency code");
  }

  // Serve cached entry when still fresh
  const cached = cache.get(raw);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ rate: cached.rate, currency: raw, updatedAt: cached.updatedAt });
  }

  try {
    // open.er-api.com — free tier, no API key required, CORS-friendly on server
    const res = await fetch(`https://open.er-api.com/v6/latest/${raw}`, {
      next: { revalidate: 3600 }, // Next.js fetch cache — 1 hour
    });

    if (!res.ok) {
      throw new Error(`upstream ${res.status}`);
    }

    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };

    if (data.result !== "success" || !data.rates?.IDR) {
      throw new Error("bad response shape");
    }

    const rate = data.rates.IDR;
    const updatedAt = data.time_last_update_utc ?? new Date().toISOString();
    const entry: CacheEntry = { rate, updatedAt, expiresAt: Date.now() + CACHE_TTL_MS };
    cache.set(raw, entry);

    return NextResponse.json({ rate, currency: raw, updatedAt });
  } catch (err) {
    console.error("fx-rate fetch failed:", err);
    return apiError("INTERNAL_ERROR", "Failed to fetch exchange rate. Enter the rate manually.");
  }
}
