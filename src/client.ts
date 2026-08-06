import { SensorReadingsResource } from "./resources/sensor-readings.js";
import { DevicesResource } from "./resources/devices.js";
import { PlantsResource } from "./resources/plants.js";
import { TasksResource } from "./resources/tasks.js";
import { LabelsResource } from "./resources/labels.js";
import type { XPlantApiResponse } from "./types.js";

/** Production API host. Override with `baseUrl` only to point at a dev server. */
export const DEFAULT_BASE_URL = "https://www.xplantpro.com";

const API_KEYS_URL = "https://www.xplantpro.com/settings/integrations";

/**
 * The shared request function passed to each resource. Returns the full
 * `{ ok, data, error, code, meta }` envelope so resources can read `meta`.
 */
export type EnvelopeRequestFn = <T>(
  path: string,
  options?: RequestInit,
) => Promise<XPlantApiResponse<T>>;

/**
 * @deprecated Resources now receive an {@link EnvelopeRequestFn}. This alias
 * describes `client.request()`, which unwraps the envelope for you.
 */
export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export interface XPlantClientConfig {
  /**
   * Your xPlant API key (xpk_live_... or xpk_dev_...).
   * Create one at https://www.xplantpro.com/settings/integrations
   *
   * Note: keep this out of version control. Use environment variables:
   *   const client = new XPlantClient({ apiKey: process.env.XPLANT_API_KEY! });
   */
  apiKey: string;
  /**
   * Override the base URL. Defaults to https://www.xplantpro.com.
   * Useful for pointing at a local dev server during testing.
   */
  baseUrl?: string;
}

/**
 * Error thrown when the xPlant API returns a failure.
 *
 * Branch on {@link XPlantError.code}, which is stable. The `message` text is
 * human-readable and may be reworded between releases.
 */
export class XPlantError extends Error {
  readonly status: number;
  /** The raw response body, as text. */
  readonly body: string;
  /** Stable machine-readable code, e.g. `FORBIDDEN` or `VALIDATION_ERROR`. */
  readonly code: string | null;

  constructor(status: number, body: string, code: string | null = null, detail?: string) {
    const suffix = code ? ` (${code})` : "";
    super(`xPlant API error ${status}${suffix}: ${detail ?? body}`);
    this.name = "XPlantError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

/** Pulls `error` and `code` out of a failure body without trusting its shape. */
function readFailure(text: string): { error?: string; code?: string } {
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

export class XPlantClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: XPlantClientConfig) {
    if (!config.apiKey) {
      throw new Error(`XPlantClient: apiKey is required. Create one at ${API_KEYS_URL}`);
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  /**
   * Perform a request and return the full `{ ok, data, error, code, meta }`
   * envelope. Use this when you need `meta`; otherwise prefer `request()`.
   *
   * Throws {@link XPlantError} on any non-2xx response, and on a 2xx body that
   * reports a failure — so an error envelope never arrives disguised as data.
   */
  async requestEnvelope<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<XPlantApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.headers ?? {}),
      },
    });

    const text = await res.text();

    if (!res.ok) {
      const { error, code } = readFailure(text);
      throw new XPlantError(res.status, text, code ?? null, error);
    }

    if (text.length === 0) {
      return { ok: true, data: undefined as T };
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      throw new XPlantError(res.status, text, "INVALID_RESPONSE", "Response body was not JSON");
    }

    if (envelope === null || typeof envelope !== "object") {
      throw new XPlantError(
        res.status,
        text,
        "INVALID_RESPONSE",
        "Response body was not an object",
      );
    }

    const result = envelope as XPlantApiResponse<T>;

    // A 2xx carrying a failure envelope is still a failure.
    if (result.ok === false || (typeof result.error === "string" && result.error.length > 0)) {
      const { error, code } = readFailure(text);
      throw new XPlantError(res.status, text, code ?? null, error);
    }

    return result;
  }

  /**
   * Perform a request and return the unwrapped `data` payload.
   *
   * Every `/api/v1` route wraps its payload in `{ ok, data }`; this hands back
   * the records themselves.
   */
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const { data } = await this.requestEnvelope<T>(path, options);
    return data;
  }

  /** Submit environmental sensor readings (temperature, humidity, CO2, light, etc.) */
  get sensorReadings(): SensorReadingsResource {
    return new SensorReadingsResource(this.requestEnvelope.bind(this));
  }

  /** Register devices, send heartbeats, and retrieve device metadata */
  get devices(): DevicesResource {
    return new DevicesResource(this.requestEnvelope.bind(this));
  }

  /** Read plant summaries — requires the `read:plants` scope */
  get plants(): PlantsResource {
    return new PlantsResource(this.requestEnvelope.bind(this));
  }

  /** Read and write tasks — requires `read:tasks` / `write:tasks` scopes */
  get tasks(): TasksResource {
    return new TasksResource(this.requestEnvelope.bind(this));
  }

  /** Resolve QR/barcode label codes to xPlant records — requires the `read:labels` scope */
  get labels(): LabelsResource {
    return new LabelsResource(this.requestEnvelope.bind(this));
  }
}
