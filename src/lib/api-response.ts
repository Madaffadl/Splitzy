// Standardized API error / success response helpers.
//
// Every error response shares the same shape:
//   { error: string; code: ErrorCode; ...context }
//
// `code` is a stable machine-readable identifier — clients should branch on it
// instead of HTTP status (which is shared across many cases) or `error` text
// (which is human-facing and may change). Extra context (field, currentVersion,
// etc.) is merged in via the third arg.

import { NextResponse } from "next/server";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "REVIEW_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "VERSION_CONFLICT"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "BAD_REQUEST"
  // An upstream dependency (currently the Gemini vision call) did not answer in
  // time. Distinct from INTERNAL_ERROR because it is transient and retrying is
  // the right advice, which the client can only say if it can tell them apart.
  | "UPSTREAM_TIMEOUT"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  REVIEW_REQUIRED: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  VERSION_CONFLICT: 409,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  BAD_REQUEST: 400,
  UPSTREAM_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
};

/**
 * Did this failure come from a cancelled/timed-out upstream call, rather than
 * the upstream genuinely rejecting the work?
 *
 * Pairs with the `UPSTREAM_TIMEOUT` code above: callers use it to answer
 * "retry" instead of "your input was bad". Matched structurally rather than
 * with `instanceof` on a vendor error class so it keeps working if an SDK
 * renames its error type, and also catches a plain fetch `AbortError`.
 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: unknown; message?: unknown };
  if (e.name === "AbortError" || e.name === "GoogleGenerativeAIAbortError") return true;
  return typeof e.message === "string" && /abort|timeout|timed out/i.test(e.message);
}

export function apiError(
  code: ErrorCode,
  message: string,
  context: Record<string, unknown> = {},
  init?: { headers?: Record<string, string> }
): NextResponse {
  return NextResponse.json(
    { error: message, code, ...context },
    { status: STATUS[code], headers: init?.headers }
  );
}
