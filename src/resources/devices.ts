import type { EnvelopeRequestFn } from "../client.js";
import { XPlantError } from "../errors.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
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
  PageParams,
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
   * `402 DEVICE_LIMIT_REACHED`. A `room_id` must be one of your workspace's
   * rooms; another workspace's answers 404. Safe to retry with an
   * `Idempotency-Key`: a repeat returns the device already registered.
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
      { ...options, idempotent: true },
    );
    return data;
  }

  /**
   * List registered devices, newest first, 200 per page by default.
   * Requires the `read:devices` scope.
   *
   * Await it for the first page, or iterate it for every device — see
   * {@link ListPromise}.
   *
   * @example
   * for await (const device of client.devices.list()) {
   *   console.log(device.name, device.status, device.last_seen_at);
   * }
   */
  list(params: PageParams = {}, options?: RequestOptions): ListPromise<DeviceSummary> {
    return new ListPromise(
      (page) =>
        this.request<DeviceSummary[]>(
          `/api/v1/devices${toQuery({ limit: page.limit, offset: page.offset, cursor: page.cursor })}`,
          {},
          options,
        ),
      params,
      // The device list did not page before it paged by cursor, so a response
      // without a cursor is the whole list — never re-request it by offset.
      { offsetFallback: false },
    );
  }

  /**
   * Fetch metadata for a registered device.
   * Requires the `read:devices` scope.
   *
   * The API has no single-device route, so this walks the workspace's devices
   * and stops at the match. Prefer `list()` when you need several. Throws
   * {@link XPlantError} with status 404 when the id is not in the workspace.
   *
   * @example
   * const device = await client.devices.get(deviceId);
   */
  async get(deviceId: string, options?: RequestOptions): Promise<DeviceSummary> {
    for await (const device of this.list({ limit: 200 }, options)) {
      if (device.id === deviceId) return device;
    }
    throw new XPlantError(404, "", "NOT_FOUND", "Device not found in this workspace");
  }

  /**
   * Record a device event — an alert, a firmware update, a config change.
   * Accepts a device token for the event's device, or a workspace key with the
   * `write:device_events` scope.
   *
   * Give each event an `external_id` and a retry after a network failure
   * records it once: a repeat resolves with the event already stored. (The
   * envelope's `meta.duplicate` marks a repeat, via `client.requestEnvelope()`.)
   *
   * @example
   * await device.devices.recordEvent({
   *   device_id: deviceId,
   *   event_type: "alert",
   *   payload: { message: "Humidity sensor not responding" },
   *   external_id: `${deviceId}-alert-${Date.now()}`,
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
   * Revoke one of a device's tokens. The token is refused from its very next
   * request. Resolves with the token's state afterwards; revoking a token that
   * is already revoked is not an error and returns the same.
   * Requires a workspace key with the `write:devices` scope.
   *
   * A token id that belongs to another device or workspace answers 404.
   *
   * @example
   * const tokens = await client.devices.listTokens(deviceId);
   * for (const t of tokens.filter((t) => t.status === "active" && t.name === "old-pi")) {
   *   await client.devices.revokeToken(deviceId, t.id);
   * }
   */
  async revokeToken(
    deviceId: string,
    tokenId: string,
    options?: WriteOptions,
  ): Promise<DeviceTokenSummary> {
    const { data } = await this.request<DeviceTokenSummary>(
      `${tokensPath(deviceId)}/${encodeURIComponent(tokenId)}`,
      { method: "DELETE" },
      options,
    );
    return data;
  }

  /**
   * List a device's tokens, newest first — prefixes, status and last use,
   * never the secrets. 200 per page by default.
   * Requires a workspace key with the `read:devices` scope.
   *
   * @example
   * const tokens = await client.devices.listTokens(deviceId);
   * const stale = tokens.filter((t) => t.status === "active" && !t.lastUsedAt);
   */
  listTokens(
    deviceId: string,
    params: PageParams = {},
    options?: RequestOptions,
  ): ListPromise<DeviceTokenSummary> {
    return new ListPromise(
      (page) =>
        this.request<DeviceTokenSummary[]>(
          `${tokensPath(deviceId)}${toQuery({ limit: page.limit, offset: page.offset, cursor: page.cursor })}`,
          {},
          options,
        ),
      params,
      { offsetFallback: false },
    );
  }
}
