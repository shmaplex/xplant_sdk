import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type {
  SensorReading,
  SensorReadingListParams,
  SensorReadingPayload,
} from "../types.js";

export class SensorReadingsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Post a new sensor reading from a device.
   * Requires the `write:sensor_readings` scope.
   *
   * @example
   * await client.sensorReadings.create({
   *   device_id: "uuid",
   *   type: "temperature",
   *   value: 24.5,
   *   unit: "C",
   * });
   */
  async create(payload: SensorReadingPayload): Promise<SensorReading> {
    const { timestamp, ...rest } = payload;
    const body: Record<string, unknown> = { ...rest };
    // `timestamp` was the documented field before 0.2.0 but the API reads
    // `recorded_at` and dropped the rest, so back-dated readings landed as "now".
    if (body.recorded_at === undefined && timestamp !== undefined) {
      body.recorded_at = timestamp;
    }

    const { data } = await this.request<SensorReading>("/api/v1/sensor-readings", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data;
  }

  /**
   * List recent sensor readings, newest first.
   * Requires the `read:sensor_readings` scope.
   *
   * Pass a device id for a single device's history, or a params object to
   * filter by room, type, or time.
   */
  async list(
    params: string | SensorReadingListParams = {},
  ): Promise<SensorReading[]> {
    const filters: SensorReadingListParams =
      typeof params === "string" ? { device_id: params } : params;

    const { data } = await this.request<SensorReading[]>(
      `/api/v1/sensor-readings${toQuery({
        device_id: filters.device_id,
        room_id: filters.room_id,
        type: filters.type,
        since: filters.since,
        limit: filters.limit,
      })}`,
    );
    return data;
  }
}
