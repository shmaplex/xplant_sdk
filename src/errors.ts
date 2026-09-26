/**
 * Codes the API is known to return. Branch on these rather than on `message`.
 *
 * Open-ended on purpose: routes also return resource-specific `*_FAILED` and
 * `*_QUERY_FAILED` codes for server-side failures, and new codes are added
 * without a new SDK release.
 */
export type XPlantErrorCode =
  /** 401 — no key, an unknown or revoked key, or a key whose owner left the workspace. */
  | "UNAUTHORIZED"
  /** 403 — the key lacks the scope, or its owner's role cannot use it. The message names which. */
  | "FORBIDDEN"
  /** 402 — the workspace's plan does not include this part of the API. */
  | "PAID_PLAN_REQUIRED"
  /** 429 — a per-key or per-workspace budget is spent. See `retryAfter`. */
  | "RATE_LIMIT_EXCEEDED"
  /** 403 — a device token was sent to an endpoint that needs a workspace key. */
  | "DEVICE_TOKEN_NOT_ACCEPTED"
  /** 403 — a device token tried to write about a device other than its own. */
  | "DEVICE_TOKEN_WRONG_DEVICE"
  /** 404 — not found, or outside the key's workspace. The API does not distinguish. */
  | "NOT_FOUND"
  /** 400 or 422 — the request failed validation. The message names the field. */
  | "VALIDATION_ERROR"
  /** 409 — a request with this `Idempotency-Key` is still running. Retry shortly. */
  | "IDEMPOTENCY_IN_FLIGHT"
  /** 422 — the cursor is malformed, from another endpoint, or reused with other filters. Start from the first page. */
  | "INVALID_CURSOR"
  /** 409 — the SOP has no version in force, so it cannot be run. */
  | "SOP_RUN_NOT_EFFECTIVE"
  /** 403 — the lab requires training on this SOP, and the key's owner isn't currently trained. */
  | "TRAINING_REQUIRED"
  /** 409 — the run has ended (completed, failed, cancelled or archived) and takes no more evidence. */
  | "SOP_RUN_CLOSED"
  /** 500 — the run could not be ended. Retry with the same `Idempotency-Key`. */
  | "SOP_RUN_UPDATE_FAILED"
  /** 409 — a device in the batch is paused or retired. */
  | "DEVICE_INGEST_DISABLED"
  /** 402 — the workspace has connected every device its plan includes. */
  | "DEVICE_LIMIT_REACHED"
  /** 503 — the device allowance could not be checked. Nothing was registered. */
  | "DEVICE_LIMIT_UNAVAILABLE"
  /** 402 — the workspace has reached a record limit its plan sets. */
  | "PLAN_LIMIT_REACHED"
  /** 402 — the plan does not include this feature (e.g. pricing, calibration history). */
  | "FEATURE_NOT_INCLUDED"
  /** 409 — the `external_id` (or another unique value) is already in use. */
  | "DUPLICATE_ENTRY"
  /** 403 — editing a teammate's plant needs its creator or a manager. */
  | "PLANT_WRITE_FORBIDDEN"
  /** 403 — editing a teammate's explant needs its creator or a manager. */
  | "EXPLANT_WRITE_FORBIDDEN"
  /** 403 — moving a teammate's plant or explant to a new stage needs its creator or a manager. */
  | "STAGE_WRITE_FORBIDDEN"
  /** 403 — only a recipe's author can edit it. */
  | "MEDIA_RECIPE_NOT_OWNER"
  /** 413 — the uploaded file is too large. */
  | "PAYLOAD_TOO_LARGE"
  /** 415 — the uploaded file's type is not supported. */
  | "UNSUPPORTED_MEDIA_TYPE"
  /** 422 — the image at `image_url` could not be fetched. */
  | "IMAGE_URL_FETCH_FAILED"
  /** Raised by the SDK itself when a success response is not a JSON object. */
  | "INVALID_RESPONSE"
  | (string & {});

/**
 * Error thrown when the xPlant API returns a failure.
 *
 * Branch on {@link XPlantError.code}, which is stable. The `message` text is
 * human-readable and may be reworded between releases. For the broad class of
 * failure — "bad key" versus "not allowed" — branch on `status`: a few older
 * device and sensor routes do not use the standard code for every status.
 */
export class XPlantError extends Error {
  readonly status: number;
  /** The raw response body, as text. */
  readonly body: string;
  /** Stable machine-readable code, e.g. `FORBIDDEN`. `null` when a gateway answered instead of the API. */
  readonly code: XPlantErrorCode | null;
  /**
   * Seconds the API asked you to wait before retrying, from the `Retry-After`
   * header. Set on `429 RATE_LIMIT_EXCEEDED` and `409 IDEMPOTENCY_IN_FLIGHT`;
   * `null` when the response carried none.
   */
  readonly retryAfter: number | null;
  /**
   * The API's id for this request, from the `X-Request-Id` header. Quote it
   * when contacting support. `null` when the response carried none.
   */
  readonly requestId: string | null;

  constructor(
    status: number,
    body: string,
    code: XPlantErrorCode | null = null,
    detail?: string,
    retryAfter: number | null = null,
    requestId: string | null = null,
  ) {
    const suffix = code ? ` (${code})` : "";
    super(`xPlant API error ${status}${suffix}: ${detail ?? body}`);
    this.name = "XPlantError";
    this.status = status;
    this.body = body;
    this.code = code;
    this.retryAfter = retryAfter;
    this.requestId = requestId;
  }
}

/**
 * The request never got an answer from the API: DNS, TLS, a dropped
 * connection, or a gateway that closed the socket. `cause` holds the error
 * `fetch` raised.
 */
export class XPlantConnectionError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown, message?: string) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(message ?? `Could not reach the xPlant API: ${reason}`);
    this.name = "XPlantConnectionError";
    this.cause = cause;
  }
}

/** An attempt took longer than the client's `timeout` and was abandoned. */
export class XPlantTimeoutError extends XPlantConnectionError {
  /** The limit that was exceeded, in milliseconds. */
  readonly timeout: number;

  constructor(timeout: number) {
    super(null, `xPlant API request timed out after ${timeout} ms`);
    this.name = "XPlantTimeoutError";
    this.timeout = timeout;
  }
}

/**
 * The request budget reported by a response's `X-RateLimit-*` headers: the
 * tighter of the key's and the workspace's per-minute budgets. The sensor
 * readings budget is not included.
 */
export interface RateLimitInfo {
  /** Requests allowed in the current window. */
  limit: number;
  /** Requests left in the current window. */
  remaining: number;
  /** Whole seconds, 1–60, until the window resets, as of `observedAt`. */
  reset: number;
  /** When the response carrying these headers arrived, in epoch milliseconds. */
  observedAt: number;
}

/** Reads `X-RateLimit-*` headers, or `null` when the response carried none. */
export function parseRateLimit(
  get: (name: string) => string | null,
  now = Date.now(),
): RateLimitInfo | null {
  const limit = Number(get("X-RateLimit-Limit"));
  const remaining = Number(get("X-RateLimit-Remaining"));
  const reset = Number(get("X-RateLimit-Reset"));
  if (get("X-RateLimit-Limit") === null || ![limit, remaining, reset].every(Number.isFinite)) {
    return null;
  }
  return { limit, remaining, reset, observedAt: now };
}

/** Pulls `error` and `code` out of a failure body without trusting its shape. */
export function readFailure(text: string): { error?: string; code?: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") return {};
    const { error, code } = parsed as { error?: unknown; code?: unknown };
    return {
      error: typeof error === "string" && error.length > 0 ? error : undefined,
      code: typeof code === "string" && code.length > 0 ? code : undefined,
    };
  } catch {
    // Not JSON — an edge proxy or gateway answered instead of the app.
    return {};
  }
}

/**
 * `Retry-After` as whole seconds. The API sends delta-seconds; an HTTP date is
 * accepted too, since a proxy in front of it may send one.
 */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}
