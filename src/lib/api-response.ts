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
  INTERNAL_ERROR: 500,
};

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
