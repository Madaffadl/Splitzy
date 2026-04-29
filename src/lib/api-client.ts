// Thin fetch wrapper for the Splitzy API.
//
// Centralizes:
//   * JSON request/response handling
//   * Error normalization (always throw `ApiError` so callers can `instanceof` check)
//   * Optimistic-concurrency response (409 → ConflictError carrying currentVersion)
//   * Same-origin URLs only (prevents accidental CSRF holes)
//
// Built so we can later add: retry on 429, request ID for tracing, in-memory
// cache, optimistic UI integration. For now it's intentionally minimal.

export type ApiErrorCode =
  | "VERSION_CONFLICT"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK"
  | "UNKNOWN";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly field?: string;
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    code: ApiErrorCode,
    body: unknown = null,
    field?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.field = field;
  }
}

export class ConflictError extends ApiError {
  readonly currentVersion: number | null;

  constructor(message: string, body: unknown, currentVersion: number | null) {
    super(message, 409, "VERSION_CONFLICT", body);
    this.name = "ConflictError";
    this.currentVersion = currentVersion;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
  /** Override JSON parsing — return raw Response. */
  raw?: boolean;
}

function statusToCode(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "VERSION_CONFLICT";
  if (status === 422) return "VALIDATION";
  if (status === 400) return "VALIDATION";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN";
}

/**
 * Issue a same-origin request to the Splitzy API. Throws on any non-2xx
 * response so callers can wrap in try/catch and pattern-match on error type.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  if (!path.startsWith("/")) {
    throw new ApiError(
      `Invalid API path: ${path}`,
      0,
      "UNKNOWN"
    );
  }

  const { method = "GET", body, signal, raw } = options;
  const init: RequestInit = {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    // Cookie-based session — Supabase sets HttpOnly cookies same-origin.
    credentials: "same-origin",
  };

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (err) {
    // Network failure (offline, DNS, etc.) — surface as ApiError so callers
    // can show a consistent toast.
    throw new ApiError(
      err instanceof Error ? err.message : "Network error",
      0,
      "NETWORK"
    );
  }

  if (raw) {
    return response as unknown as T;
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (response.ok) {
    return data as T;
  }

  // Error path — normalize.
  const message =
    (data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : null) ??
    `Request failed with status ${response.status}`;

  if (response.status === 409) {
    const currentVersion =
      data && typeof data === "object" && "currentVersion" in data && typeof data.currentVersion === "number"
        ? (data.currentVersion as number)
        : null;
    throw new ConflictError(message, data, currentVersion);
  }

  const field =
    data && typeof data === "object" && "field" in data && typeof data.field === "string"
      ? data.field
      : undefined;

  throw new ApiError(message, response.status, statusToCode(response.status), data, field);
}
