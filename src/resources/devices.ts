import type { EnvelopeRequestFn } from "../client.js";
import { XPlantError } from "../client.js";
import type {
  DeviceHeartbeatPayload,
  DeviceRegisterPayload,
  DeviceSummary,
  HeartbeatResponse,
} from "../types.js";

export class DevicesResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Signal that a device is alive and connected.
   * Call this periodically (e.g. every 5 minutes) from firmware.
   * Requires the `write:devices` scope.
   *
   * @param metadata Accepted for backward compatibility and **ignored by the
   * API** — the heartbeat endpoint reads no request body. Send firmware and
   * network details via `devices.register()` instead.
   */
  async heartbeat(
    deviceId: string,
    metadata?: DeviceHeartbeatPayload,
  ): Promise<HeartbeatResponse> {
    const { data } = await this.request<HeartbeatResponse>(
      `/api/v1/devices/${encodeURIComponent(deviceId)}/heartbeat`,
      { method: "POST", body: JSON.stringify(metadata ?? {}) },
    );
    return data;
  }

  /**
   * Register a new device in the workspace.
   * Requires the `write:devices` scope.
   */
  async register(payload: DeviceRegisterPayload): Promise<DeviceSummary> {
    const { data } = await this.request<DeviceSummary>("/api/v1/devices", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data;
  }

  /**
   * List registered devices.
   * Requires the `read:devices` scope.
   */
  async list(): Promise<DeviceSummary[]> {
    const { data } = await this.request<DeviceSummary[]>("/api/v1/devices");
    return data;
  }

  /**
   * Fetch metadata for a registered device.
   * Requires the `read:devices` scope.
   *
   * The API has no single-device route, so this lists the workspace's devices
   * and selects one. Prefer `list()` when you need several. Throws
   * {@link XPlantError} with status 404 when the id is not in the workspace.
   */
  async get(deviceId: string): Promise<DeviceSummary> {
    const devices = await this.list();
    const device = devices.find((candidate) => candidate.id === deviceId);
    if (!device) {
      throw new XPlantError(404, "", "NOT_FOUND", "Device not found in this workspace");
    }
    return device;
  }
}
