import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, getAuthUser } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
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

        const limited = enforceRateLimit(request, "parse-receipt", {
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

        const prompt = `Analyze this receipt image and extract all items with their prices.

Return ONLY a JSON object in this exact format, no other text:
{
  "items": [
    {"name": "Item Name", "qty": 1, "price": 25000}
  ],
  "tax": 0,
  "service": 0
}

Rules:
1. Extract ALL food/drink items from the receipt
2. "price" should be the TOTAL price for that line item (after qty multiplication if shown)
3. "qty" should be the quantity if shown (e.g., "2x Nasi Goreng" = qty:2), default to 1
4. "tax" is the tax amount if shown (may be labeled as Tax, PB1, PPN, Pajak)
5. "service" is the service charge if shown (may be labeled as Service, SC, Service Charge)
6. Prices use Indonesian formatting: "." is the THOUSANDS separator and "," is the DECIMAL separator. Return the whole-Rupiah integer value: drop the cents/decimal part, and NEVER merge the cents digits into the number. Examples: "700.000,00" -> 700000 (NOT 70000000, NOT 700); "Rp 1.234.567" -> 1234567; "25.000" -> 25000; "12.500,50" -> 12500
7. Do NOT include subtotals, totals, payment methods, or change
8. If you cannot read the receipt clearly, return {"items": [], "tax": 0, "service": 0}

Extract the items now:`;

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: base64Data,
                },
            },
            prompt,
        ]);

        const response = await result.response;
        const text = response.text();

        const parsed = extractJsonObject(text);
        if (!parsed) {
            console.error("Failed to extract JSON from Gemini response");
            return NextResponse.json({
                items: [],
                tax: 0,
                service: 0,
                error: "Failed to parse response",
            });
        }

        if (!parsed.items || !Array.isArray(parsed.items)) {
            return NextResponse.json({
                items: [],
                tax: 0,
                service: 0,
            });
        }

        // Bound the array — defensive against runaway model output.
        const rawItems = parsed.items.slice(0, 200);

        const cleanedItems = rawItems
            .map((raw: unknown) => {
                if (!raw || typeof raw !== "object") return null;
                const item = raw as Record<string, unknown>;
                const name = typeof item.name === "string" ? item.name.trim() : "";
                if (!name) return null;

                // Gemini usually returns a number, but when it returns a string
                // it may still carry Indonesian separators — parse robustly so a
                // stray "700.000,00" isn't deflated/inflated.
                const priceNum = typeof item.price === "number"
                    ? item.price
                    : parseIndonesianPrice(String(item.price));
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

        const taxRaw = typeof parsed.tax === "number" ? parsed.tax : parseIndonesianPrice(String(parsed.tax));
        const serviceRaw = typeof parsed.service === "number" ? parsed.service : parseIndonesianPrice(String(parsed.service));

        // Count successful scans against the user's monthly quota.
        if (authUser) {
            void incrementScanCount(authUser.id);
        }

        return NextResponse.json({
            items: cleanedItems,
            tax: Number.isFinite(taxRaw) && taxRaw >= 0 ? taxRaw : 0,
            service: Number.isFinite(serviceRaw) && serviceRaw >= 0 ? serviceRaw : 0,
        });
    } catch (error) {
        console.error("Gemini API error:", error);
        return apiError("INTERNAL_ERROR", "Failed to process image");
    }
}
