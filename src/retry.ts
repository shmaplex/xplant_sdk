import type { XPlantError } from "./errors.js";

/** Tuning for the client's opt-in retry. Pass `retry: true` for these defaults. */
export interface RetryOptions {
  /** Retries after the first attempt. Defaults to 2. */
  maxRetries?: number;
  /** First backoff wait for a network error or a 502/503/504, doubled per attempt. Defaults to 500 ms. */
  baseDelayMs?: number;
  /**
   * Longest single wait. A `Retry-After` longer than this is not waited out —
   * the error is thrown with `retryAfter` set so you can reschedule the work.
   * Defaults to 60 000 ms, the length of the API's rate-limit window.
   */
  maxDelayMs?: number;
}

export type ResolvedRetry = Required<RetryOptions>;

const DEFAULTS: ResolvedRetry = { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 60_000 };

export function resolveRetry(retry: boolean | RetryOptions | undefined): ResolvedRetry | null {
  if (!retry) return null;
  if (retry === true) return DEFAULTS;
  return {
    maxRetries: Math.max(0, Math.floor(retry.maxRetries ?? DEFAULTS.maxRetries)),
    baseDelayMs: Math.max(0, retry.baseDelayMs ?? DEFAULTS.baseDelayMs),
    maxDelayMs: Math.max(0, retry.maxDelayMs ?? DEFAULTS.maxDelayMs),
  };
}

/** Exponential backoff with jitter, so a fleet of devices does not retry in lockstep. */
function backoff(policy: ResolvedRetry, attempt: number): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return ceiling / 2 + Math.random() * (ceiling / 2);
}

/** Honours `Retry-After` when present, else backs off; `null` when it is longer than allowed. */
function serverDelay(policy: ResolvedRetry, attempt: number, error: XPlantError): number | null {
  if (error.retryAfter === null) return backoff(policy, attempt);
  const ms = error.retryAfter * 1000;
  return ms <= policy.maxDelayMs ? ms : null;
}

/**
 * How long to wait before resending after an error response, or `null` to throw.
 *
 * @param resendable - A read, or a write whose endpoint replays a repeated
 *   `Idempotency-Key`. Only these may be resent after a response that does not
 *   prove the request was refused before it ran.
 */
export function responseRetryDelay(
  policy: ResolvedRetry,
  attempt: number,
  error: XPlantError,
  resendable: boolean,
): number | null {
  if (attempt >= policy.maxRetries) return null;

  // Refused before the handler ran, on every method — resending cannot double a write.
  if (error.status === 429) return serverDelay(policy, attempt, error);
  // The first attempt with this key is still running; a resend gets its result.
  if (error.status === 409 && error.code === "IDEMPOTENCY_IN_FLIGHT") {
    return serverDelay(policy, attempt, error);
  }
  // A gateway failure says nothing about whether the write landed.
  if (resendable && (error.status === 502 || error.status === 503 || error.status === 504)) {
    return serverDelay(policy, attempt, error);
  }
  return null;
}

/** How long to wait before resending after `fetch` itself rejected, or `null` to throw. */
export function networkRetryDelay(
  policy: ResolvedRetry,
  attempt: number,
  resendable: boolean,
): number | null {
  if (!resendable || attempt >= policy.maxRetries) return null;
  return backoff(policy, attempt);
}

/** Resolves after `ms`, or rejects with the signal's reason when it aborts first. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * A fresh `Idempotency-Key`: `xpsdk-` plus 32 hex characters.
 *
 * Uses Web Crypto where the runtime has it. Node 18 exposes no global `crypto`,
 * and the key only has to be unique per intent — it guards against a duplicate
 * write, not against an attacker — so `Math.random` is an acceptable fallback.
 */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `xpsdk-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
