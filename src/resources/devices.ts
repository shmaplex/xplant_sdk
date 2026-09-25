import type { EnvelopeRequestFn } from "../client.js";
import { XPlantError } from "../errors.js";
import type {
  DeviceEvent,
  DeviceEventPayload,
  DeviceHeartbeatPayload,
  DeviceRegisterPayload,
  DeviceSummary,
  DeviceTokenCreateInput,
  DeviceTokenMinted,
  DeviceTokenSummary,
  HeartbeatResponse,
  RequestOptions,
  WriteOptions,
} from "../types.js";

function tokensPath(deviceId: string): string {
  return `/api/v1/devices/${encodeURIComponent(deviceId)}/tokens`;
}

export class DevicesResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Signal that a device is alive and connected.
   * Call this periodically (e.g. every 5 minutes) from firmware.
   * Accepts a device token for this device, or a workspace key with the
   * `write:devices` scope.
   *
   * @param metadata Accepted for backward compatibility and **ignored by the
   * API** — the heartbeat endpoint reads no request body. Send firmware and
   * network details via `devices.register()` instead.
   *
   * @example
   * const { received_at } = await device.devices.heartbeat(deviceId);
   */
  async heartbeat(
    deviceId: string,
    metadata?: DeviceHeartbeatPayload,
    options?: WriteOptions,
  ): Promise<HeartbeatResponse> {
    const { data } = await this.request<HeartbeatResponse>(
      `/api/v1/devices/${encodeURIComponent(deviceId)}/heartbeat`,
      { method: "POST", body: JSON.stringify(metadata ?? {}) },
      options,
    );
    return data;
  }

  /**
   * Register a new device in the workspace.
   * Requires the `write:devices` scope.
   *
   * A workspace that has connected every device its plan includes answers
   * `402 DEVICE_LIMIT_REACHED`.
   *
   * @example
   * const device = await client.devices.register({
   *   name: "Growth Room 1 — Temp/Humidity",
   *   type: "sensor",
   *   hardware: "esp32",
   * });
   */
  async register(payload: DeviceRegisterPayload, options?: WriteOptions): Promise<DeviceSummary> {
    const { data } = await this.request<DeviceSummary>(
      "/api/v1/devices",
      { method: "POST", body: JSON.stringify(payload) },
      options,
    );
    return data;
  }

  /**
   * List registered devices, newest first. This endpoint does not page.
   * Requires the `read:devices` scope.
   *
   * @example
   * const devices = await client.devices.list();
   */
  async list(options?: RequestOptions): Promise<DeviceSummary[]> {
    const { data } = await this.request<DeviceSummary[]>("/api/v1/devices", {}, options);
    return data;
  }

  /**
   * Fetch metadata for a registered device.
   * Requires the `read:devices` scope.
   *
   * The API has no single-device route, so this lists the workspace's devices
   * and selects one. Prefer `list()` when you need several. Throws
   * {@link XPlantError} with status 404 when the id is not in the workspace.
   *
   * @example
   * const device = await client.devices.get(deviceId);
   */
  async get(deviceId: string, options?: RequestOptions): Promise<DeviceSummary> {
    const devices = await this.list(options);
    const device = devices.find((candidate) => candidate.id === deviceId);
    if (!device) {
      throw new XPlantError(404, "", "NOT_FOUND", "Device not found in this workspace");
    }
    return device;
  }

  /**
   * Record a device event — an alert, a firmware update, a config change.
   * Accepts a device token for the event's device, or a workspace key with the
   * `write:device_events` scope.
   *
   * @example
   * await device.devices.recordEvent({
   *   device_id: deviceId,
   *   event_type: "alert",
   *   payload: { message: "Humidity sensor not responding" },
   * });
   */
  async recordEvent(payload: DeviceEventPayload, options?: WriteOptions): Promise<DeviceEvent> {
    const { data } = await this.request<DeviceEvent>(
      "/api/v1/device-events",
      { method: "POST", body: JSON.stringify(payload) },
      options,
    );
    return data;
  }

  /**
   * Create a device token for one registered device.
   * Requires a **workspace key** with the `write:devices` scope — a device
   * cannot create tokens for itself.
   *
   * The token is in the result **once**. Nothing can read it back later, so
   * put it on the device straight away; if it is lost, create another.
   *
   * @example
   * // On a setup machine, with a workspace key:
   * const { token } = await client.devices.createToken(deviceId, { name: "shelf-3-pi" });
   * // Then on the device:
   * const device = new XPlantClient({ deviceToken: token });
   */
  async createToken(
    deviceId: string,
    input: DeviceTokenCreateInput = {},
    options?: WriteOptions,
  ): Promise<DeviceTokenMinted> {
    const { data } = await this.request<DeviceTokenMinted>(
      tokensPath(deviceId),
      { method: "POST", body: JSON.stringify(input) },
      options,
    );
    return data;
  }

  /**
   * List a device's tokens, newest first — prefixes, status and last use,
   * never the secrets.
   * Requires a workspace key with the `read:devices` scope.
   *
   * @example
   * const tokens = await client.devices.listTokens(deviceId);
   * const stale = tokens.filter((t) => t.status === "active" && !t.lastUsedAt);
   */
  async listTokens(deviceId: string, options?: RequestOptions): Promise<DeviceTokenSummary[]> {
    const { data } = await this.request<DeviceTokenSummary[]>(tokensPath(deviceId), {}, options);
    return data;
  }
}
