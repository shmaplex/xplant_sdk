import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import {
  MAX_SENSOR_BATCH,
  SensorReadingBuffer,
  type SensorBufferOptions,
} from "../sensor-buffer.js";
import type {
  RequestOptions,
  SensorReading,
  SensorReadingListParams,
  SensorReadingPayload,
  WriteOptions,
} from "../types.js";

export { MAX_SENSOR_BATCH };

function toWire(payload: SensorReadingPayload): Record<string, unknown> {
  const { timestamp, ...rest } = payload;
  const body: Record<string, unknown> = { ...rest };
  // `timestamp` was the documented field before 0.2.0 but the API reads
  // `recorded_at` and dropped the rest, so back-dated readings landed as "now".
  if (body.recorded_at === undefined && timestamp !== undefined) {
    body.recorded_at = timestamp;
  }
  return body;
}

export class SensorReadingsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Post one sensor reading.
   * Accepts a device token for the reading's device, or a workspace key with
   * the `write:sensor_readings` scope.
   *
   * Prefer {@link createBatch} for anything that samples on a schedule: one
   * request per reading spends the rate limit many times faster.
   *
   * @example
   * await device.sensorReadings.create({
   *   device_id: deviceId,
   *   type: "temperature",
   *   value: 24.5,
   *   unit: "C",
   * });
   */
  async create(payload: SensorReadingPayload, options?: WriteOptions): Promise<SensorReading> {
    const { data } = await this.request<SensorReading>(
      "/api/v1/sensor-readings",
      { method: "POST", body: JSON.stringify(toWire(payload)) },
      options,
    );
    return data;
  }

  /**
   * Post up to 500 readings in one request.
   * Same credentials as {@link create}. A device token may only include its
   * own device's readings — one foreign `device_id` refuses the whole batch.
   *
   * Give every reading an `external_id` and a `recorded_at`, and a batch you
   * resend after a network failure is not stored twice. The result lists the
   * readings stored by this request; a duplicate that was dropped is absent.
   *
   * @example
   * await device.sensorReadings.createBatch(
   *   buffered.map((r) => ({
   *     device_id: deviceId,
   *     type: r.type,
   *     value: r.value,
   *     unit: r.unit,
   *     recorded_at: r.at,
   *     external_id: `${deviceId}-${r.type}-${r.at}`,
   *   })),
   * );
   */
  async createBatch(
    readings: SensorReadingPayload[],
    options?: WriteOptions,
  ): Promise<SensorReading[]> {
    if (readings.length === 0 || readings.length > MAX_SENSOR_BATCH) {
      throw new RangeError(
        `sensorReadings.createBatch() takes 1–${MAX_SENSOR_BATCH} readings; got ${readings.length}`,
      );
    }
    const { data } = await this.request<SensorReading[]>(
      "/api/v1/sensor-readings",
      { method: "POST", body: JSON.stringify({ readings: readings.map(toWire) }) },
      options,
    );
    return data;
  }

  /**
   * A buffer that batches readings and sends them in the background — the way
   * a device should post. Readings are sent every `flushIntervalMs` (30 s) or
   * once `maxBatch` (500) are waiting, kept through outages, and resent safely.
   * See {@link SensorReadingBuffer}.
   *
   * @example
   * const buffer = device.sensorReadings.buffer();
   * setInterval(() => {
   *   buffer.add({ device_id: deviceId, type: "humidity", value: readHumidity(), unit: "%" });
   * }, 60_000);
   * process.on("SIGTERM", () => buffer.close().finally(() => process.exit(0)));
   */
  buffer(options?: SensorBufferOptions): SensorReadingBuffer {
    return new SensorReadingBuffer((readings) => this.createBatch(readings), options);
  }

  /**
   * List recent sensor readings, newest first. This endpoint takes a `limit`
   * but no `offset` — narrow with `since` to walk back further.
   * Requires a workspace key with the `read:sensor_readings` scope.
   *
   * Pass a device id for a single device's history, or a params object to
   * filter by room, type, or time.
   *
   * @example
   * const recent = await client.sensorReadings.list({
   *   room_id: roomId,
   *   type: "temperature",
   *   since: "2026-08-01T00:00:00Z",
   * });
   */
  async list(
    params: string | SensorReadingListParams = {},
    options?: RequestOptions,
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
      {},
      options,
    );
    return data;
  }
}
