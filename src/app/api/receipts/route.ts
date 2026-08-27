import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import {
  validationErrorResponse,
  ValidationError,
} from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  validateSavedSplit,
  savedSplitExpiryFromNow,
  SAVED_SPLIT_TTL_DAYS,
} from "@/lib/receipt/saved-splits";

// Cursor format is `<ISO createdAt>|<id>`. Two columns are needed for stable
// ordering when multiple rows share the same createdAt (rare, but safe).
const CURSOR_SEP = "|";

function encodeCursor(createdAt: Date, id: string): string {
  // base64url to keep it URL-safe and opaque to clients.
  return Buffer.from(`${createdAt.toISOString()}${CURSOR_SEP}${id}`)
    .toString("base64url");
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.indexOf(CURSOR_SEP);
    if (sep === -1) return null;
    const createdAt = new Date(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

// GET /api/receipts - List receipts for the authenticated user.
//
// Pagination supports two modes for backward compat:
//   * `?cursor=<opaque>` (preferred) — keyset pagination, O(log n) regardless
//     of position, scales to millions of rows.
//   * `?page=<n>` (legacy) — offset pagination, fine for first dozen pages.
//
// Cursor mode skips the COUNT(*) query and returns only `nextCursor`/`hasMore`.
/** One receipt inside a stored payload. */
interface PayloadReceipt {
  items?: { total?: unknown }[];
  tax?: unknown;
  service?: unknown;
  fees?: { amount?: unknown }[];
}

/**
 * Normalise a stored payload to the list of receipts it contains.
 *
 * Two shapes exist. A saved split wraps everything as
 * `{ title, participants, receipts[] }`; a row written by the localStorage
 * import is a single bare receipt. Both are read here so the history list works
 * regardless of which path produced the row.
 */
function payloadReceipts(payload: Prisma.JsonValue | null): PayloadReceipt[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as { receipts?: unknown };
  if (Array.isArray(p.receipts)) return p.receipts as PayloadReceipt[];
  return [payload as PayloadReceipt];
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Headline amount for a row in the history list.
 *
 * `tax + service` alone — what this used to return — omits the items entirely,
 * so a Rp 500.000 dinner with Rp 50.000 tax was listed as "Rp 50.000".
 */
function summariseAmount(row: {
  tax: number;
  service: number;
  payloadJson: Prisma.JsonValue | null;
}): number {
  if (!row.payloadJson) return row.tax + row.service;

  const total = payloadReceipts(row.payloadJson).reduce((sum, r) => {
    const items = (r.items ?? []).reduce((s, i) => s + num(i?.total), 0);
    const fees = (r.fees ?? []).reduce((s, f) => s + num(f?.amount), 0);
    return sum + items + num(r.tax) + num(r.service) + fees;
  }, 0);

  // Face value of the bill; manual discounts are a per-person credit and are
  // deliberately not netted off a list-level headline.
  return Math.round(total * 100) / 100;
}

/** Which editor should reopen this split. Absent on legacy/import rows. */
function payloadType(payload: Prisma.JsonValue | null): "single" | "multiple" | null {
  if (!payload || typeof payload !== "object") return null;
  const t = (payload as { type?: unknown }).type;
  return t === "multiple" || t === "single" ? t : null;
}

/** How many people this split was shared between. Was hardcoded to 0. */
function countParticipants(row: { participantsJson: Prisma.JsonValue | null }): number {
  return Array.isArray(row.participantsJson) ? row.participantsJson.length : 0;
}

/**
 * Items across every receipt in the split. Saved splits create no relational
 * item rows — the payload is the record — so `_count.items` reads 0 for them.
 */
function countItems(row: {
  payloadJson: Prisma.JsonValue | null;
  _count: { items: number };
}): number {
  if (!row.payloadJson) return row._count.items;
  return payloadReceipts(row.payloadJson).reduce((sum, r) => sum + (r.items?.length ?? 0), 0);
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const search = searchParams.get("search") || "";
  const cursorRaw = searchParams.get("cursor");

  const baseWhere: Prisma.ReceiptWhereInput = {
    AND: [
      // Hide soft-deleted rows.
      { deletedAt: null },
      // User must be involved in the receipt
      {
        OR: [
          { createdById: user.id },
          { payerId: user.id },
          { items: { some: { assignments: { some: { userId: user.id } } } } },
          { trip: { members: { some: { userId: user.id } } } },
        ],
      },
      // Search filter
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { trip: { name: { contains: search, mode: "insensitive" as const } } },
              ],
            },
          ]
        : []),
    ],
  };

  // ---- Cursor mode (preferred) ----
  if (cursorRaw !== null) {
    const cursor = cursorRaw === "" ? null : decodeCursor(cursorRaw);
    if (cursorRaw !== "" && cursor === null) {
      return apiError("BAD_REQUEST", "Invalid cursor", { field: "cursor" });
    }

    const where: Prisma.ReceiptWhereInput = cursor
      ? {
          AND: [
            baseWhere,
            // Strict less-than on (createdAt, id) — tuple inequality.
            {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            },
          ],
        }
      : baseWhere;

    // Fetch one extra to know if there's a next page without an extra query.
    const rows = await prisma.receipt.findMany({
      where,
      select: {
        id: true,
        title: true,
        tax: true,
        service: true,
        date: true,
        createdAt: true,
        tripId: true,
        payloadJson: true,
        participantsJson: true,
        expiresAt: true,
        shareCode: true,
        trip: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    return NextResponse.json({
      data: page.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date?.toISOString() ?? null,
        totalAmount: summariseAmount(r),
        participantCount: countParticipants(r),
        expiresAt: r.expiresAt?.toISOString() ?? null,
        shareCode: r.shareCode ?? null,
        type: payloadType(r.payloadJson),
        createdAt: r.createdAt.toISOString(),
        tripName: r.trip?.name ?? null,
        tripId: r.tripId,
        itemCount: countItems(r),
      })),
      limit,
      hasMore,
      nextCursor,
    });
  }

  // ---- Offset mode (legacy) ----
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const skip = (page - 1) * limit;

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where: baseWhere,
      select: {
        id: true,
        title: true,
        tax: true,
        service: true,
        date: true,
        createdAt: true,
        tripId: true,
        payloadJson: true,
        participantsJson: true,
        expiresAt: true,
        shareCode: true,
        trip: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.receipt.count({ where: baseWhere }),
  ]);

  return NextResponse.json({
    data: receipts.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date?.toISOString() ?? null,
      totalAmount: summariseAmount(r),
      participantCount: countParticipants(r),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      shareCode: r.shareCode ?? null,
      type: payloadType(r.payloadJson),
      createdAt: r.createdAt.toISOString(),
      tripName: r.trip?.name ?? null,
      tripId: r.tripId,
      itemCount: countItems(r),
    })),
    total,
    page,
    limit,
    hasMore: skip + limit < total,
  });
}

// POST /api/receipts - Save a split (Single or Multiple) so it can be resumed.
//
// The body is the whole split as one document — title, participants and one or
// more receipts — and it is stored in payload_json. The relational columns on
// this table are legacy: item_assignments is keyed on users.id, so they cannot
// express a split between named people who have no account. Everything the
// editor needs to reopen the split lives in the payload.
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "receipts:create", { userId: user.id });
  if (limited) return limited;

  let input;
  try {
    const body = await request.json().catch(() => null);
    input = validateSavedSplit(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  const receipt = await prisma.receipt.create({
    data: {
      title: input.title,
      // Owner of the saved row. The person who actually fronted the bill is a
      // participant id inside the payload — this column is a User FK and can
      // only ever mean "whose account is this saved under".
      payerId: user.id,
      tax: 0,
      service: 0,
      createdById: user.id,
      participantsJson: input.participants as unknown as Prisma.InputJsonValue,
      payloadJson: input as unknown as Prisma.InputJsonValue,
      expiresAt: savedSplitExpiryFromNow(),
    },
    select: { id: true, expiresAt: true, version: true },
  });

  return NextResponse.json(
    {
      id: receipt.id,
      version: receipt.version,
      expiresAt: receipt.expiresAt?.toISOString() ?? null,
      ttlDays: SAVED_SPLIT_TTL_DAYS,
    },
    { status: 201 }
  );
}
