import {
  XPlantConnectionError,
  XPlantError,
  XPlantTimeoutError,
  parseRateLimit,
  parseRetryAfter,
  readFailure,
  type RateLimitInfo,
} from "./errors.js";
import {
  networkRetryDelay,
  newIdempotencyKey,
  resolveRetry,
  responseRetryDelay,
  sleep,
  type ResolvedRetry,
  type RetryOptions,
} from "./retry.js";
import { AssetsResource } from "./resources/assets.js";
import { CommentsResource } from "./resources/comments.js";
import { CommerceResource } from "./resources/commerce.js";
import { ContaminationsResource } from "./resources/contaminations.js";
import { DevicesResource } from "./resources/devices.js";
import { EquipmentResource } from "./resources/equipment.js";
import { EventsResource } from "./resources/events.js";
import { ExplantsResource } from "./resources/explants.js";
import { LabelsResource } from "./resources/labels.js";
import { MediaRecipesResource } from "./resources/media-recipes.js";
import { MeResource } from "./resources/me.js";
import { PlantsResource } from "./resources/plants.js";
import { PricingResource } from "./resources/pricing.js";
import { SensorReadingsResource } from "./resources/sensor-readings.js";
import { SopRunsResource } from "./resources/sop-runs.js";
import { SopsResource } from "./resources/sops.js";
import { StagesResource } from "./resources/stages.js";
import { TaskDemandResource } from "./resources/task-demand.js";
import { TasksResource } from "./resources/tasks.js";
import { TransfersResource } from "./resources/transfers.js";
import { WorkspacesResource } from "./resources/workspaces.js";
import type { WriteOptions, XPlantApiResponse } from "./types.js";

export { XPlantError } from "./errors.js";

/**
 * The API host. `www.xplantpro.com` is the marketing site and answers 401 for
 * every `/api/*` path; the API and the app live here.
 */
export const DEFAULT_BASE_URL = "https://app.xplantpro.com";

/** Where API keys are created and managed. */
export const API_KEYS_URL = "https://app.xplantpro.com/settings/integrations/api-keys";

const DEVICE_TOKEN_PREFIX = "xpd_";

/** How long one attempt may take by default, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Options for a single request. Resources set `idempotent` on endpoints that
 * replay a repeated `Idempotency-Key`; it is exported for callers of
 * `requestEnvelope()` who reach such an endpoint directly.
 */
export interface CallOptions extends WriteOptions {
  /**
   * The endpoint answers a repeated `Idempotency-Key` with the stored result,
   * so the request may be resent after a network failure without running
   * twice. Leave unset for endpoints that ignore the header.
   */
  idempotent?: boolean;
}

/**
 * The shared request function passed to each resource. Returns the full
 * `{ ok, data, error, code, meta }` envelope so resources can read `meta`.
 */
export type EnvelopeRequestFn = <T>(
  path: string,
  init?: RequestInit,
  options?: CallOptions,
) => Promise<XPlantApiResponse<T>>;

/**
 * @deprecated Resources now receive an {@link EnvelopeRequestFn}. This alias
 * describes `client.request()`, which unwraps the envelope for you.
 */
export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export interface XPlantClientConfig {
  /**
   * A workspace API key (`xpk_live_…` or `xpk_dev_…`). Create one at
   * https://app.xplantpro.com/settings/integrations/api-keys
   *
   * Keep it out of version control — read it from the environment:
   *   new XPlantClient({ apiKey: process.env.XPLANT_API_KEY })
   *
   * A workspace key can read and write the whole workspace, so it does not
   * belong on a device in a shared room. Give a device a `deviceToken` instead.
   */
  apiKey?: string;
  /**
   * A device token (`xpd_live_…` or `xpd_dev_…`), bound to one device. It can
   * post that device's sensor readings, events and heartbeat, and nothing else.
   * Create one with `client.devices.createToken()` using a workspace key.
   *
   * Pass either `apiKey` or `deviceToken`, not both.
   */
  deviceToken?: string;
  /**
   * Override the API host. Defaults to https://app.xplantpro.com. Set this only
   * to point at a development server.
   */
  baseUrl?: string;
  /**
   * Retry rate-limited and transiently failed requests. Off by default.
   *
   * - `429` and `409 IDEMPOTENCY_IN_FLIGHT` are retried on any method after the
   *   `Retry-After` wait — the API refused them before doing any work.
   * - Network errors and `502`/`503`/`504` are retried for reads, and for
   *   writes to endpoints that replay a repeated `Idempotency-Key`.
   *
   * While retry is on, every write carries an `Idempotency-Key`: yours if you
   * pass one, otherwise one generated per call and reused across its attempts.
   */
  retry?: boolean | RetryOptions;
  /**
   * Milliseconds each attempt may take, including reading the response, before
   * it is abandoned with `XPlantTimeoutError`. Defaults to 60 000. `0` waits
   * indefinitely. A timed-out read is retried when `retry` is on.
   */
  timeout?: number;
  /** A `fetch` implementation to use instead of the global one — e.g. to log or trace requests. */
  fetch?: typeof fetch;
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...(headers as Record<string, string>) };
}

/**
 * An abort signal for one attempt: fires when the caller's signal does, or when
 * `timeoutMs` elapses. Without a timeout, the caller's signal is used as is.
 */
function attemptSignal(outer: AbortSignal | undefined, timeoutMs: number) {
  if (!(timeoutMs > 0 && Number.isFinite(timeoutMs))) {
    return { signal: outer, timedOut: () => false, done: () => {} };
  }
  const controller = new AbortController();
  let timedOut = false;
  const forward = () => controller.abort(outer?.reason);
  if (outer?.aborted) forward();
  else outer?.addEventListener("abort", forward, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new XPlantTimeoutError(timeoutMs));
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", forward);
    },
  };
}

function readHeader(res: Response, name: string): string | null {
  // Tolerates a minimal fetch polyfill whose responses carry no `headers`.
  return typeof res.headers?.get === "function" ? res.headers.get(name) : null;
}

export class XPlantClient {
  private readonly baseUrl: string;
  private readonly credential: string;
  private readonly retry: ResolvedRetry | null;
  private readonly fetchImpl: (input: string, init: RequestInit) => Promise<Response>;
  private readonly timeout: number;
  private lastRateLimit: RateLimitInfo | null = null;

  constructor(config: XPlantClientConfig) {
    const { apiKey, deviceToken } = config;
    if (apiKey && deviceToken) {
      throw new Error("XPlantClient: pass apiKey or deviceToken, not both");
    }
    if (deviceToken !== undefined) {
      if (!deviceToken.startsWith(DEVICE_TOKEN_PREFIX)) {
        throw new Error(
          "XPlantClient: deviceToken must be a device token (xpd_…). Never put a workspace API key on a device — create a device token with client.devices.createToken() and use that.",
        );
      }
      this.credential = deviceToken;
    } else if (apiKey) {
      this.credential = apiKey;
    } else {
      throw new Error(
        `XPlantClient: apiKey is required (or deviceToken, on a device). Create a key at ${API_KEYS_URL}`,
      );
    }

    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.retry = resolveRetry(config.retry);
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    const custom = config.fetch;
    // Resolved per call, and never called as a method of the config object:
    // browsers reject `fetch` invoked with a `this` that is not the window.
    this.fetchImpl = custom
      ? (input, init) => custom(input, init)
      : (input, init) => globalThis.fetch(input, init);
  }

  /**
   * Perform a request and return the full `{ ok, data, error, code, meta }`
   * envelope. Use this when you need `meta`; otherwise prefer `request()`.
   *
   * Throws {@link XPlantError} on any non-2xx response, and on a 2xx body that
   * reports a failure — so an error envelope never arrives disguised as data.
   * A request that never got an answer throws {@link XPlantConnectionError},
   * or {@link XPlantTimeoutError} when it ran past `timeout`. Aborting through
   * `signal` rejects with the signal's reason.
   */
  async requestEnvelope<T>(
    path: string,
    init: RequestInit = {},
    options: CallOptions = {},
  ): Promise<XPlantApiResponse<T>> {
    const method = (init.method ?? "GET").toUpperCase();
    const isRead = method === "GET" || method === "HEAD";
    const idempotencyKey = isRead
      ? undefined
      : (options.idempotencyKey ?? (this.retry ? newIdempotencyKey() : undefined));
    const signal = options.signal ?? init.signal ?? undefined;
    // Safe to resend after an answer that never arrived: a read, or a write the
    // server would recognise as the same one and answer from its record.
    const resendable = isRead || (options.idempotent === true && idempotencyKey !== undefined);

    const request: RequestInit = {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.credential}`,
        ...(idempotencyKey !== undefined ? { "Idempotency-Key": idempotencyKey } : {}),
        ...headerRecord(init.headers),
      },
    };
    const url = `${this.baseUrl}${path}`;
    const timeoutMs = options.timeout ?? this.timeout;

    for (let attempt = 0; ; attempt++) {
      const guard = attemptSignal(signal, timeoutMs);
      let res: Response;
      let text: string;
      try {
        res = await this.fetchImpl(url, {
          ...request,
          ...(guard.signal ? { signal: guard.signal } : {}),
        });
        // Inside the timeout: a body that stalls halfway is as stuck as no answer.
        text = await res.text();
        guard.done();
      } catch (err) {
        guard.done();
        if (signal?.aborted) throw signal.reason ?? err;
        const failure = guard.timedOut()
          ? new XPlantTimeoutError(timeoutMs)
          : new XPlantConnectionError(err);
        const delay = this.retry ? networkRetryDelay(this.retry, attempt, resendable) : null;
        if (delay === null) throw failure;
        await sleep(delay, signal);
        continue;
      }

      // The API reports the budget on every 2xx and 429. A 2xx or 429 without
      // the headers means the counter could not be read — unknown, not
      // unlimited — so the last reading is dropped rather than kept stale.
      if (res.ok || res.status === 429) {
        this.lastRateLimit = parseRateLimit((name) => readHeader(res, name));
      }

      if (!res.ok) {
        const { error, code } = readFailure(text);
        const failure = new XPlantError(
          res.status,
          text,
          code ?? null,
          error,
          parseRetryAfter(readHeader(res, "Retry-After")),
          readHeader(res, "X-Request-Id"),
        );
        const delay = this.retry
          ? responseRetryDelay(this.retry, attempt, failure, resendable)
          : null;
        if (delay === null) throw failure;
        await sleep(delay, signal);
        continue;
      }

      return { ...this.readSuccess<T>(res.status, text), requestId: readHeader(res, "X-Request-Id") };
    }
  }

  private readSuccess<T>(status: number, text: string): XPlantApiResponse<T> {
    if (text.length === 0) {
      return { ok: true, data: undefined as T };
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      throw new XPlantError(status, text, "INVALID_RESPONSE", "Response body was not JSON");
    }

    if (envelope === null || typeof envelope !== "object") {
      throw new XPlantError(status, text, "INVALID_RESPONSE", "Response body was not an object");
    }

    const result = envelope as XPlantApiResponse<T>;

    // A 2xx carrying a failure envelope is still a failure.
    if (result.ok === false || (typeof result.error === "string" && result.error.length > 0)) {
      const { error, code } = readFailure(text);
      throw new XPlantError(status, text, code ?? null, error);
    }

    return result;
  }

  /**
   * The request budget reported by the most recent successful or `429`
   * response: `{ limit, remaining, reset, observedAt }`, where `reset` is whole
   * seconds from `observedAt`. It is the tighter of the key's and the
   * workspace's per-minute budgets; the sensor readings budget isn't included.
   * `null` before any response, and after a response that couldn't report it —
   * treat that as unknown, not unlimited.
   */
  get rateLimit(): RateLimitInfo | null {
    return this.lastRateLimit;
  }

  /**
   * Perform a request and return the unwrapped `data` payload.
   *
   * Every `/api/v1` route wraps its payload in `{ ok, data }`; this hands back
   * the records themselves.
   */
  async request<T>(path: string, init: RequestInit = {}, options: CallOptions = {}): Promise<T> {
    const { data } = await this.requestEnvelope<T>(path, init, options);
    return data;
  }

  private get send(): EnvelopeRequestFn {
    return this.requestEnvelope.bind(this);
  }

  /** The key's own identity, scopes and workspace — needs no scope */
  get me(): MeResource {
    return new MeResource(this.send);
  }

  /** The workspace this key acts in — requires the `read:workspace` scope */
  get workspaces(): WorkspacesResource {
    return new WorkspacesResource(this.send);
  }

  /** Read plant summaries — requires the `read:plants` scope */
  get plants(): PlantsResource {
    return new PlantsResource(this.send);
  }

  /** Read explant (batch) summaries — requires the `read:explants` scope */
  get explants(): ExplantsResource {
    return new ExplantsResource(this.send);
  }

  /** Read and advance tissue-culture stages — requires `read:transfers` / `write:transfers` */
  get stages(): StagesResource {
    return new StagesResource(this.send);
  }

  /** Read and record transfers — requires `read:transfers` / `write:transfers` */
  get transfers(): TransfersResource {
    return new TransfersResource(this.send);
  }

  /** Read plant and explant change history — requires the `read:events` scope */
  get events(): EventsResource {
    return new EventsResource(this.send);
  }

  /** Read and write tasks — requires `read:tasks` / `write:tasks` */
  get tasks(): TasksResource {
    return new TasksResource(this.send);
  }

  /** Read and push demand signals — requires `read:tasks` / `write:demand` */
  get taskDemand(): TaskDemandResource {
    return new TaskDemandResource(this.send);
  }

  /** Read protocols and the version in force — requires the `read:sops` scope */
  get sops(): SopsResource {
    return new SopsResource(this.send);
  }

  /** Start SOP runs and post step evidence — requires `read:sop_runs` / `write:sop_runs` / `write:sop_steps` */
  get sopRuns(): SopRunsResource {
    return new SopRunsResource(this.send);
  }

  /** Resolve label codes and record scans — requires `read:labels` / `write:label_scans` */
  get labels(): LabelsResource {
    return new LabelsResource(this.send);
  }

  /** Register devices, send heartbeats, record events and manage device tokens */
  get devices(): DevicesResource {
    return new DevicesResource(this.send);
  }

  /** Post and read environmental sensor readings */
  get sensorReadings(): SensorReadingsResource {
    return new SensorReadingsResource(this.send);
  }

  /** Read the equipment library and record use and maintenance — `read:equipment` / `write:equipment_events` */
  get equipment(): EquipmentResource {
    return new EquipmentResource(this.send);
  }

  /** Read and log contaminations — `read:contaminations` / `write:contaminations` */
  get contaminations(): ContaminationsResource {
    return new ContaminationsResource(this.send);
  }

  /** Read and add comments on records — `read:comments` / `write:comments` */
  get comments(): CommentsResource {
    return new CommentsResource(this.send);
  }

  /** Read and attach photos and media — `read:assets` / `write:assets` */
  get assets(): AssetsResource {
    return new AssetsResource(this.send);
  }

  /** Read and write media recipes — `read:media_recipes` / `write:media_recipes` */
  get mediaRecipes(): MediaRecipesResource {
    return new MediaRecipesResource(this.send);
  }

  /** Read culture line prices and price history — `read:pricing`, manager role */
  get pricing(): PricingResource {
    return new PricingResource(this.send);
  }

  /** Read store order lines and sell-through — `read:commerce`, manager role */
  get commerce(): CommerceResource {
    return new CommerceResource(this.send);
  }
}
