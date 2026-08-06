import { SensorReadingsResource } from "./resources/sensor-readings.js";
import { DevicesResource } from "./resources/devices.js";
import { PlantsResource } from "./resources/plants.js";
import { TasksResource } from "./resources/tasks.js";
import { LabelsResource } from "./resources/labels.js";

/** Internal type for the shared request function passed to each resource. */
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

/** The `{ ok, data, error, code }` envelope every `/api/v1` route returns. */
interface XPlantResultEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/** Error thrown when the xPlant API returns a non-2xx response, or a response envelope with `ok: false`. */
export class XPlantError extends Error {
  readonly status: number;
  readonly body: string;
  /** Stable machine-readable error code from the response envelope (e.g. `"FORBIDDEN"`), when available. */
  readonly code?: string;

  constructor(status: number, body: string, code?: string) {
    super(`xPlant API error ${status}: ${body}`);
    this.name = "XPlantError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

export class XPlantClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: XPlantClientConfig) {
    if (!config.apiKey) {
      throw new Error(
        "XPlantClient: apiKey is required. " +
          "Create one at https://www.xplantpro.com/settings/integrations",
      );
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://www.xplantpro.com").replace(/\/$/, "");
  }

  /**
   * Every `/api/v1` route returns the app-wide `Result` envelope
   * (`{ ok, data, error, code }`), not the resource shape directly.
   * This unwraps `data` on success and throws `XPlantError` — with the
   * envelope's `error`/`code` when present — on failure.
   */
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.headers ?? {}),
      },
    });

    const text = await res.text();
    let envelope: XPlantResultEnvelope<T> | undefined;
    try {
      envelope = text ? (JSON.parse(text) as XPlantResultEnvelope<T>) : undefined;
    } catch {
      envelope = undefined;
    }

    if (!res.ok || !envelope?.ok) {
      throw new XPlantError(res.status, envelope?.error ?? text, envelope?.code);
    }

    return envelope.data as T;
  }

  /** Submit environmental sensor readings (temperature, humidity, CO2, lux, etc.) */
  get sensorReadings(): SensorReadingsResource {
    return new SensorReadingsResource(this.request.bind(this));
  }

  /** Register devices, send heartbeats, and retrieve device metadata */
  get devices(): DevicesResource {
    return new DevicesResource(this.request.bind(this));
  }

  /** Read plant summaries — requires `read:plants` scope */
  get plants(): PlantsResource {
    return new PlantsResource(this.request.bind(this));
  }

  /** Read task summaries — requires `read:tasks` scope */
  get tasks(): TasksResource {
    return new TasksResource(this.request.bind(this));
  }

  /** Resolve QR/barcode label codes to xPlant records — requires `read:labels` scope */
  get labels(): LabelsResource {
    return new LabelsResource(this.request.bind(this));
  }
}
