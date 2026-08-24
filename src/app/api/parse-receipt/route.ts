import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { assertSameOrigin, getAuthUser } from "@/lib/api-auth";
import { apiError, isAbortError } from "@/lib/api-response";
import { parseIndonesianPrice } from "@/lib/parser";
import { checkScanQuota, incrementScanCount } from "@/lib/scan-quota";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Best-effort: 10 receipt scans per minute per client IP.
// Gemini billing scales with calls, so this caps accidental cost spikes.
const PARSE_RATE_LIMIT = 10;
const PARSE_RATE_WINDOW_MS = 60_000;

// Cap base64 payload at ~6.7MB → roughly 5MB binary, which is well above
// what a phone camera produces after compression. Anything larger is almost
// certainly accidental or abusive.
const MAX_IMAGE_BASE64_LENGTH = 7_000_000;
const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i;

// Hard ceiling on the vision call. Without one, a slow or hung Gemini response
// pins this serverless worker until the platform kills it; enough concurrent
// scans and there are no workers left to serve anything else.
//
// Kept below `maxDuration` so OUR timeout fires first and the user gets a
// specific "took too long, try again" instead of an opaque platform 504.
// Note the SDK aborts client-side only: the upstream call still completes and
// is still billed, so this protects capacity, not cost — that's what the rate
// limit above is for.
const GEMINI_TIMEOUT_MS = 45_000;

// Vision on a photo legitimately takes longer than a normal request, so opt out
// of the short default. Must exceed GEMINI_TIMEOUT_MS by enough to send a reply.
export const maxDuration = 60;

// Robust JSON extractor: Gemini may wrap JSON in markdown fences (```json ... ```)
// or include narrative text. We strip code fences first, then walk the string
// to find the first balanced top-level object — quote-aware so braces inside
// strings don't confuse the matcher.
function extractJsonObject(text: string): Record<string, unknown> | null {
    if (!text) return null;

    // Strip ```json ... ``` or ``` ... ``` fences if present.
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenceMatch ? fenceMatch[1] : text;

    const start = candidate.indexOf("{");
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < candidate.length; i++) {
        const ch = candidate[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === "\\" && inString) {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                const slice = candidate.slice(start, i + 1);
                try {
                    const parsed = JSON.parse(slice);
                    return typeof parsed === "object" && parsed !== null
                        ? (parsed as Record<string, unknown>)
                        : null;
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const csrf = assertSameOrigin(request);
        if (csrf) return csrf;

        const limited = await enforceRateLimitAsync(request, "parse-receipt", {
            limit: PARSE_RATE_LIMIT,
            windowMs: PARSE_RATE_WINDOW_MS,
        });
        if (limited) return limited;

        // Monthly AI scan quota — only enforced for authenticated users.
        const authUser = await getAuthUser(request);
        if (authUser) {
            const quota = await checkScanQuota(authUser.id);
            if (!quota.allowed) {
                return apiError(
                    "QUOTA_EXCEEDED",
                    `Monthly scan limit reached (${quota.plan === "free" ? 15 : "∞"} scans/month). Upgrade to Pro for unlimited scans.`,
                    { remaining: 0, resetAt: quota.resetAt?.toISOString() ?? null }
                );
            }
        }

        const body = await request.json().catch(() => null);
        const image = typeof body?.image === "string" ? body.image : null;

        if (!image) {
            return apiError("BAD_REQUEST", "No image provided", { field: "image" });
        }

        if (image.length > MAX_IMAGE_BASE64_LENGTH) {
            return apiError("PAYLOAD_TOO_LARGE", "Image too large. Please use a photo under 5MB.");
        }

        const mimeMatch = image.match(/^data:(image\/[\w+.-]+);base64,/);
        const mimeType = mimeMatch?.[1] || "image/jpeg";

        if (!ALLOWED_MIME.test(mimeType)) {
            return apiError(
                "UNSUPPORTED_MEDIA_TYPE",
                "Unsupported image format. Use JPEG, PNG, WebP, or HEIC."
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return apiError("INTERNAL_ERROR", "Gemini API key not configured");
        }

        // Extract base64 data from data URL
        const base64Data = image.replace(/^data:image\/[\w+.-]+;base64,/, "");

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Analyze this receipt image and extract all items, fees, and discounts.

The receipt or bill may occupy only part of the image — identify the receipt area and focus your analysis on it, ignoring any background, table surface, or surroundings.

Return ONLY a JSON object in this exact format, no other text:
{
  "currency": "IDR",
  "items": [
    {"name": "Item Name", "qty": 1, "price": 25000}
  ],
  "tax": 0,
  "service": 0,
  "fees": [
    {"label": "Delivery Fee", "amount": 15000, "splitMethod": "equal"}
  ],
  "discounts": [
    {"label": "Diskon Member", "type": "amount", "value": 10000, "scope": "receipt"}
  ]
}

Rules:
1. Extract ALL food/drink/product items from the receipt into "items".
2. "currency" is the ISO 4217 code detected from symbols/text on the receipt:
   - "Rp", "IDR", "Rupiah" → "IDR" (default)
   - "₫", "VND", "đồng", "dong" → "VND"
   - "฿", "THB", "บาท", "Baht" → "THB"
   - "S$", "SGD", "Singapore" context → "SGD"
   - "RM", "MYR", "Ringgit" → "MYR"
   - "¥" in Japanese context, "JPY", "円", "yen" → "JPY"
   - "₩", "KRW", "원", "Won" → "KRW"
   - "$" (US context), "USD" → "USD"
   - "€", "EUR" → "EUR"
   - "£", "GBP" → "GBP"
   - "A$", "AUD" → "AUD"
   If unsure, default to "IDR".
3. "price" should be the TOTAL price for that line item (after qty multiplication if shown).
4. "qty" should be the quantity if shown (e.g., "2x Nasi Goreng" = qty:2), default to 1.
5. "tax" is the tax amount if shown (labeled: Tax, PB1, PPN, Pajak, VAT, GST).
6. "service" is the service charge if shown (labeled: Service, SC, Service Charge).
7. "fees" — capture ALL other fees that are NOT tax or service: delivery fee, platform fee, packaging fee, small order fee, rain surcharge, driver tip, handling fee, etc.
   - "label": exact label as printed on receipt (e.g. "Delivery Fee", "Ongkos Kirim", "Biaya Layanan", "Platform Fee").
   - "amount": fee amount as a positive number.
   - "splitMethod": use "equal" for delivery/platform/packaging/surcharge fees (not tied to order value); use "proportional" for fees that scale with order amount.
8. "discounts" — capture ALL discount/promo lines:
   - "label": exact label as printed (e.g. "Diskon Member", "Promo GOFOOD", "Voucher").
   - "type": "percent" if a % symbol is present, "amount" otherwise.
   - "value": always POSITIVE (e.g. "-10.000" on receipt → value: 10000; "15%" → value: 15).
   - "scope": "item" if the discount immediately follows a specific item AND clearly refers to it; "receipt" for all other cases (generic discount, voucher, promo at the bottom of the bill). When in doubt, use "receipt".
   - "itemName": ONLY for scope "item" — the exact name of the item it applies to.
9. Return prices as plain decimal numbers — no thousand-separators, no currency symbols:
   - IDR uses "." as thousands sep and "," as decimal: "700.000,00" → 700000; "25.000" → 25000
   - Other currencies typically use "," as thousands sep and "." as decimal: "1,234.50" → 1234.50
10. Do NOT include subtotals, totals, payment methods, or change in "items".
11. If you cannot read the receipt clearly, return {"currency": "IDR", "items": [], "tax": 0, "service": 0, "fees": [], "discounts": []}

Extract now:`;

        const result = await model.generateContent(
            [
                {
                    inlineData: {
                        mimeType,
                        data: base64Data,
                    },
                },
                prompt,
            ],
            { timeout: GEMINI_TIMEOUT_MS }
        );

        const response = await result.response;
        const text = response.text();

        const parsed = extractJsonObject(text);
        if (!parsed) {
            console.error("Failed to extract JSON from Gemini response");
            return NextResponse.json({
                currency: "IDR",
                items: [],
                tax: 0,
                service: 0,
                error: "Failed to parse response",
            });
        }

        // Extract and normalise the detected currency code.
        const CURRENCY_RE = /^[A-Z]{2,10}$/;
        const detectedCurrency =
            typeof parsed.currency === "string" && CURRENCY_RE.test(parsed.currency.trim().toUpperCase())
                ? parsed.currency.trim().toUpperCase()
                : "IDR";

        if (!parsed.items || !Array.isArray(parsed.items)) {
            return NextResponse.json({
                currency: detectedCurrency,
                items: [],
                tax: 0,
                service: 0,
            });
        }

        // Non-IDR receipts typically use standard decimal notation (period as
        // decimal separator). For IDR we keep the existing parseIndonesianPrice
        // path; for everything else we fall back to parseFloat.
        const isIDR = detectedCurrency === "IDR";

        // Bound the array — defensive against runaway model output.
        const rawItems = parsed.items.slice(0, 200);

        const cleanedItems = rawItems
            .map((raw: unknown) => {
                if (!raw || typeof raw !== "object") return null;
                const item = raw as Record<string, unknown>;
                const name = typeof item.name === "string" ? item.name.trim() : "";
                if (!name) return null;

                // Gemini usually returns a number; string fallback uses the
                // appropriate parser for the detected currency.
                const priceNum = typeof item.price === "number"
                    ? item.price
                    : isIDR
                        ? parseIndonesianPrice(String(item.price))
                        : parseFloat(String(item.price));
                if (!Number.isFinite(priceNum) || priceNum <= 0) return null;

                const qtyNum = typeof item.qty === "number"
                    ? item.qty
                    : parseInt(String(item.qty), 10);
                const qty = Number.isFinite(qtyNum) && qtyNum >= 1
                    ? Math.min(1000, Math.floor(qtyNum))
                    : 1;

                return { name, qty, price: priceNum };
            })
            .filter((item): item is { name: string; qty: number; price: number } => item !== null);

        const parseFee = (v: unknown) =>
            typeof v === "number" ? v : isIDR ? parseIndonesianPrice(String(v)) : parseFloat(String(v ?? "0"));
        const taxRaw = parseFee(parsed.tax);
        const serviceRaw = parseFee(parsed.service);

        // Parse extra fees (delivery, platform, etc.)
        const cleanedFees = Array.isArray(parsed.fees)
            ? parsed.fees
                .slice(0, 20)
                .map((raw: unknown) => {
                    if (!raw || typeof raw !== "object") return null;
                    const f = raw as Record<string, unknown>;
                    const label = typeof f.label === "string" ? f.label.trim() : "";
                    if (!label) return null;
                    const amountRaw = typeof f.amount === "number" ? f.amount : parseFee(f.amount);
                    if (!Number.isFinite(amountRaw) || amountRaw <= 0) return null;
                    const splitMethod = f.splitMethod === "proportional" ? "proportional" : "equal";
                    return { label, amount: amountRaw, splitMethod };
                })
                .filter((f): f is { label: string; amount: number; splitMethod: "equal" | "proportional" } => f !== null)
            : [];

        // Parse discounts
        const cleanedDiscounts = Array.isArray(parsed.discounts)
            ? parsed.discounts
                .slice(0, 20)
                .map((raw: unknown) => {
                    if (!raw || typeof raw !== "object") return null;
                    const d = raw as Record<string, unknown>;
                    const label = typeof d.label === "string" ? d.label.trim() : "";
                    if (!label) return null;
                    const type = d.type === "percent" ? "percent" : "amount";
                    const valueRaw = typeof d.value === "number" ? Math.abs(d.value) : Math.abs(parseFee(d.value));
                    if (!Number.isFinite(valueRaw) || valueRaw <= 0) return null;
                    if (type === "percent" && valueRaw > 100) return null;
                    const scope = d.scope === "item" ? "item" : "receipt";
                    const itemName = scope === "item" && typeof d.itemName === "string" ? d.itemName.trim() : undefined;
                    return { label, type, value: valueRaw, scope, itemName };
                })
                .filter((d) => d !== null) as { label: string; type: "amount" | "percent"; value: number; scope: "receipt" | "item"; itemName?: string }[]
            : [];

        // Count successful scans against the user's monthly quota.
        if (authUser) {
            await incrementScanCount(authUser.id).catch((err) =>
                console.error("scan-quota increment failed:", err)
            );
        }

        return NextResponse.json({
            currency: detectedCurrency,
            items: cleanedItems,
            tax: Number.isFinite(taxRaw) && taxRaw >= 0 ? taxRaw : 0,
            service: Number.isFinite(serviceRaw) && serviceRaw >= 0 ? serviceRaw : 0,
            fees: cleanedFees,
            discounts: cleanedDiscounts,
        });
    } catch (error) {
        // A timeout is transient and retrying usually works, so it gets its own
        // code and message. Lumping it into INTERNAL_ERROR told the user their
        // receipt was unreadable, which sent them off cropping a photo that was
        // fine all along.
        if (isAbortError(error)) {
            console.warn(`Gemini timed out after ${GEMINI_TIMEOUT_MS}ms`);
            return apiError(
                "UPSTREAM_TIMEOUT",
                "Scanning took too long. Please try again."
            );
        }
        console.error("Gemini API error:", error);
        return apiError("INTERNAL_ERROR", "Failed to process image");
    }
}
