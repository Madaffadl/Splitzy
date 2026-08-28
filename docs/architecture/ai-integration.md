# Splitzy — AI Integration (Google Generative AI)

> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 1. Scope **[IMPLEMENTED]**

AI is used for exactly **one** feature: **receipt scanning**. A photo of a receipt goes in;
structured line items, tax, service, extra fees, discounts and a detected currency come out.

There is no chat, no embeddings, no RAG, no agent, no summarisation. `@google/generative-ai` is
imported in exactly one file:

```
src/app/api/parse-receipt/route.ts
```

Verified with `grep -rn "@google/generative-ai" src` — one hit.

| Property | Value |
|---|---|
| SDK | `@google/generative-ai ^0.24.1` |
| Model | **`gemini-2.5-flash`** |
| Execution | **Server-side only** (Node.js runtime route handler) |
| Endpoint | `POST /api/parse-receipt` |
| Env var | `GEMINI_API_KEY` (server-only, never `NEXT_PUBLIC_*`) |
| Feature flag | **None** — the feature is always on when the key is set |
| `maxDuration` | 60 s |
| Client timeout on the vision call | 45 s |

**[IMPLEMENTED]** The key never reaches the browser: the client posts a base64 image to our own
route, which holds the key. The SDK client is constructed once at module scope:
`new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")`.

---

## 2. Trigger and client-side preparation **[IMPLEMENTED]**

Component: [src/components/receipt/ReceiptInput.tsx](../../src/components/receipt/ReceiptInput.tsx).

Two entry points, both `<input type="file" accept="image/*">`:

- **Upload** — file picker.
- **Camera** — the same input with `capture="environment"`.

**[IMPLEMENTED]** This is why `Permissions-Policy: camera=()` in `next.config.mjs` is safe — a
`capture` file input does not require the camera permission.

Before upload the client:

1. Reads the file as a data URL (`FileReader.readAsDataURL`).
2. **Resizes** it via a `<canvas>`: longest edge capped at **1920 px**, re-encoded as
   `image/jpeg` at quality **0.85** (`resizeImage`). Failures fall back to the original data URL.
3. **Checks `navigator.onLine`** first, and short-circuits with an offline message rather than
   letting a network failure surface as "your photo is bad". The in-code rationale:
   *"Restaurant Wi-Fi is the likeliest failure in this whole flow… People re-shoot a perfectly good
   receipt, twice, then give up and open the calculator."*

Request body: `{ "image": "data:image/jpeg;base64,…" }`.

---

## 3. Server-side request handling **[IMPLEMENTED]**

Order of operations in `POST /api/parse-receipt`:

| # | Step | Failure response |
|---|---|---|
| 1 | `assertSameOrigin(request)` | `403 FORBIDDEN` |
| 2 | `enforceRateLimitAsync(request, "parse-receipt", { limit: 10, windowMs: 60_000 })` | `429 RATE_LIMITED` + `Retry-After` |
| 3 | `getAuthUser(request)` — **optional**; guests proceed | — |
| 4 | If authenticated: `checkScanQuota(user.id)` | `429 QUOTA_EXCEEDED` + `{ remaining: 0, resetAt }` |
| 5 | Body parse; require `body.image` to be a string | `400 BAD_REQUEST` `{ field: "image" }` |
| 6 | `image.length > 7_000_000` (≈5 MB binary) | `413 PAYLOAD_TOO_LARGE` |
| 7 | MIME sniffed from the data-URL prefix; must match `/^image\/(jpeg\|jpg\|png\|webp\|heic\|heif)$/i` | `415 UNSUPPORTED_MEDIA_TYPE` |
| 8 | `GEMINI_API_KEY` present | `500 INTERNAL_ERROR "Gemini API key not configured"` |
| 9 | Call Gemini with a 45 s timeout | `504 UPSTREAM_TIMEOUT` / `500 INTERNAL_ERROR` |
| 10 | Extract + sanitise JSON | soft-fail (see §6) |
| 11 | If authenticated: `incrementScanCount(user.id)` — best effort, `.catch(console.error)` | never fails the response |

**[IMPLEMENTED]** Note step 3/4: **the monthly quota is enforced only for authenticated users**.
A guest is bounded only by the 10-scans-per-minute IP limit.

---

## 4. What is sent to Google **[IMPLEMENTED]**

```ts
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const result = await model.generateContent(
  [
    { inlineData: { mimeType, data: base64Data } },   // the resized receipt photo
    prompt,                                            // the text prompt below
  ],
  { timeout: GEMINI_TIMEOUT_MS }                       // 45_000
);
```

Sent: **the receipt image bytes and the prompt.** Nothing else — no user id, no email, no trip or
participant names, no session token, no history. **[IMPLEMENTED]**

**[INFERRED]** Privacy exposure is therefore whatever is visible in the photograph: merchant name,
date, items, totals, and any card-tail or loyalty number printed on the receipt. There is no
redaction step.

**[IMPLEMENTED]** There **is** a user-facing disclosure at the point of upload, localised in both
languages and rendered beside the scan control: *"Your photo is sent to Google Gemini for parsing
and is not stored by Splitzy. Avoid uploading receipts with sensitive personal data."*
(`dictionaries/en.ts:836`, `id.ts:856`). Confirmed by rendering the page in Phase C.

No generation config is set — no `temperature`, no `responseMimeType: "application/json"`, no
`responseSchema`, no safety-setting overrides. All Gemini defaults apply. **[IMPLEMENTED]**

---

## 5. The prompt **[IMPLEMENTED]**

Quoted verbatim from
[src/app/api/parse-receipt/route.ts:142-197](../../src/app/api/parse-receipt/route.ts#L142-L197):

````text
Analyze this receipt image and extract all items, fees, and discounts.

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

Extract now:
````

Prompt-engineering choices worth noting:

- **Framing instruction** (paragraph 2) tells the model to locate the receipt within a wider photo —
  this is the "far-away scan" mitigation on the model side.
- **Explicit empty-result contract** (rule 11) gives the model a legal way to say "unreadable"
  instead of hallucinating items.
- **Indonesian vocabulary is first-class**: `PB1`, `PPN`, `Pajak`, `Ongkos Kirim`, `Biaya Layanan`,
  `Diskon Member`, `Promo GOFOOD`.
- **Locale-aware number formatting** (rule 9) — `700.000,00` is seven hundred thousand in IDR, not
  seven hundred.
- **Conservative discount scoping** (rule 8) — "when in doubt, use receipt", which spreads the
  benefit across everyone rather than misattributing it to one person.

---

## 6. Response parsing and sanitisation **[IMPLEMENTED]**

### 6.1 `extractJsonObject(text)`

Gemini's response is *not* trusted to be clean JSON. The extractor:

1. Strips ```` ```json … ``` ```` / ```` ``` … ``` ```` fences if present.
2. Finds the first `{`, then walks the string tracking `depth`, `inString` and `escape`, so braces
   inside string values do not confuse the matcher.
3. `JSON.parse` on the first balanced top-level object; any throw returns `null`.

### 6.2 Field-by-field hardening

Every value from the model is re-derived, bounded, and type-checked:

| Field | Sanitisation |
|---|---|
| `currency` | Must match `/^[A-Z]{2,10}$/` after trim+uppercase, else `"IDR"` |
| `items` | Not an array → return an empty result. Otherwise **`.slice(0, 200)`** |
| `items[].name` | Must be a non-empty trimmed string, else the row is dropped |
| `items[].price` | Number, or parsed — `parseIndonesianPrice` for IDR, `parseFloat` otherwise. Must be finite and `> 0`, else dropped |
| `items[].qty` | Integer ≥ 1, **clamped to ≤ 1000**, defaults to 1 |
| `tax`, `service` | Parsed with the same currency-aware helper; negatives and non-finite values become `0` |
| `fees` | **`.slice(0, 20)`**; label required; amount finite and `> 0`; `splitMethod` coerced to `"equal"` unless exactly `"proportional"` |
| `discounts` | **`.slice(0, 20)`**; label required; `type` coerced to `"amount"` unless exactly `"percent"`; `value` = `Math.abs(...)`, must be `> 0`; **a percent > 100 is rejected outright**; `scope` coerced to `"receipt"` unless exactly `"item"`; `itemName` only kept for item scope |

**[INFERRED]** The design principle is that the model's output is *untrusted input*, treated with
the same suspicion as a request body — exactly right for an LLM boundary.

### 6.3 Response shape

```jsonc
{
  "currency": "IDR",
  "items":     [{ "name": "Nasi Goreng", "qty": 2, "price": 50000 }],
  "tax":       5000,
  "service":   3000,
  "fees":      [{ "label": "Delivery Fee", "amount": 15000, "splitMethod": "equal" }],
  "discounts": [{ "label": "Diskon Member", "type": "amount", "value": 10000, "scope": "receipt" }]
}
```

Two **soft-failure** shapes return `200`, not an error:

- Unparsable model output → `{ currency: "IDR", items: [], tax: 0, service: 0, error: "Failed to parse response" }`
- `parsed.items` missing or not an array → `{ currency, items: [], tax: 0, service: 0 }`

**[IMPLEMENTED]** In both cases `incrementScanCount` is **not** reached (the code returns early), so
an unusable scan does not consume quota.

---

## 7. Client-side post-processing **[IMPLEMENTED]**

Back in `ReceiptInput`:

1. Each item becomes a `ReceiptItem` with a fresh `generateId()`,
   `unitPrice = roundTo2(price / qty)`, `total = roundTo2(price)`, `assignedToIds: []`.
2. **Item-scope discounts are matched by name → UUID**: a case-insensitive bidirectional
   `includes` between `d.itemName` and each item name. **If no item matches, the discount is
   downgraded to `scope: "receipt"`** — it is never silently dropped.
3. Fees become `ReceiptFee[]` with generated ids.
4. `currency` is only carried through when it is not `"IDR"` (IDR is the implicit base).
5. `onParsed(parseResult)` fires after a 500 ms delay so the success state is visible.
6. Downstream, `ReceiptEditor` sees a non-IDR currency and fetches `/api/fx-rate?from=<code>` to
   lock an FX rate onto the receipt.

---

## 8. Error handling **[IMPLEMENTED]**

| Condition | Server | Client message source |
|---|---|---|
| Offline before sending | — | `t.offline` (localised) — checked via `navigator.onLine` |
| Quota exceeded | `429 QUOTA_EXCEEDED` | thrown as `__QUOTA__` → renders `<ScanQuotaPaywall>` and fires `scan_quota_hit` |
| Gemini timeout (> 45 s) | `504 UPSTREAM_TIMEOUT` | thrown as `__TIMEOUT__` → `t.timedOut` ("took too long, try again") |
| Connection dropped mid-request | — | `t.dropped` |
| Model output unparsable | `200` with `error` field | shows the error text |
| Zero items extracted | `200` with `items: []` | `t.noItems` |
| Anything else | `500 INTERNAL_ERROR` | `t.failedGeneric` |

**[IMPLEMENTED]** The timeout path is a deliberate product decision, documented in the source:
lumping it into `INTERNAL_ERROR` *"told the user their receipt was unreadable, which sent them off
cropping a photo that was fine all along."*

`isAbortError()` in [api-response.ts](../../src/lib/api-response.ts) matches structurally on
`name === "AbortError" || name === "GoogleGenerativeAIAbortError"` or a
`/abort|timeout|timed out/i` message — chosen over `instanceof` so it survives an SDK renaming its
error class.

---

## 9. Cost and capacity controls **[IMPLEMENTED]**

| Control | Value | Protects |
|---|---|---|
| IP rate limit | 10 scans / 60 s | Cost spikes from a single client |
| Monthly quota (authenticated only) | `FREE_SCAN_LIMIT = 15`, unlimited on active Pro, per-user `aiScanLimit` override | Sustained per-account cost |
| Payload cap | 7 000 000 base64 chars ≈ 5 MB | Upload + token cost |
| Client-side resize | 1920 px longest edge, JPEG q0.85 | Bandwidth and input tokens |
| Model choice | `gemini-2.5-flash` (the cheap, fast tier) | Unit cost |
| Timeout | 45 s | **Worker capacity, not cost** |
| Output caps | 200 items / 20 fees / 20 discounts | Runaway output handling |

**[IMPLEMENTED]** The timeout comment is explicit that it protects capacity rather than spend:
*"the SDK aborts client-side only: the upstream call still completes and is still billed."*

**[IMPLEMENTED]** Guests are **not** subject to the monthly quota — only the per-IP limit.
**[INFERRED]** With no account required, sustained anonymous scanning is bounded only at
10/min/IP, which is an open cost exposure.

### Quota mechanics — [src/lib/scan-quota.ts](../../src/lib/scan-quota.ts)

- `checkScanQuota(userId)` → `{ allowed, remaining, resetAt, plan }`.
- Active Pro (`isProActive`) short-circuits to unlimited.
- Effective limit = `user.aiScanLimit ?? FREE_SCAN_LIMIT`.
- If `aiScanResetAt <= now`, the counter is reset to 0 and the window cleared **during the check**.
- `incrementScanCount` bumps the counter and, on the first scan of a new window, sets
  `aiScanResetAt` to midnight UTC on the 1st of next month.
- `resetScanQuota` is the admin action behind `PATCH /api/admin/users/[id] { resetQuota: true }`.

**[IMPLEMENTED]** Check and increment are two separate statements, so the cap is not strictly atomic
under concurrency.

---

## 10. AI-related analytics **[IMPLEMENTED]**

| Event | Fired at | Properties |
|---|---|---|
| `scan_started` | Just before the fetch | — |
| `scan_completed` | On a successful parse | `{ items, currency }` |
| `scan_quota_hit` | On `QUOTA_EXCEEDED` | — |
| `upgrade_clicked` | Paywall CTA | `{ source: "scan_paywall" }` |

There is no logging of prompts, responses, images, or model latency to any store. Failures reach
`console.error`/`console.warn` only (and Sentry, if a DSN is configured, via the runtime's uncaught
handler). **[IMPLEMENTED]**

---

## 11. End-to-end trace

See [../flows/ai-scan-flow.md](../flows/ai-scan-flow.md) for the full sequence diagram.

---

## 12. Observations and gaps

| # | Observation | Label |
|---|---|---|
| 1 | No feature flag on the AI feature — it cannot be turned off without unsetting `GEMINI_API_KEY` | **[IMPLEMENTED]** |
| 2 | No structured-output mode (`responseMimeType` / `responseSchema`) is requested, so the hand-rolled fence-stripping JSON extractor is load-bearing | **[IMPLEMENTED]** |
| 3 | No retry on a transient Gemini failure — the user retries manually | **[IMPLEMENTED]** |
| 4 | Guest scans bypass the monthly quota entirely | **[IMPLEMENTED]** |
| 5 | Quota check → increment is not atomic | **[IMPLEMENTED]** |
| 6 | No confidence score is requested or surfaced; "low confidence" is indistinguishable from "empty receipt" | **[IMPLEMENTED]** |
| 7 | ~~No disclosure at the upload point~~ — **corrected in Phase C.** A localised notice *is* rendered beside the upload control in both languages: *"Your photo is sent to Google Gemini for parsing and is not stored by Splitzy. Avoid uploading receipts with sensitive personal data."* (`dictionaries/en.ts:836`, `id.ts:856`). Verified by rendering `/single?step=bill` | **[IMPLEMENTED]** |
| 8 | Google's data-retention terms for the API key's project (free vs paid tier behaviour differs materially) | **[UNKNOWN]** — not determinable from the repo |
| 9 | A planned UX improvement — a rectangular framing overlay on the camera view to coach users to fill the frame — is not present in the code | **[IMPLEMENTED]** absence |
