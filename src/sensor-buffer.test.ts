import { afterEach, describe, expect, it, vi } from "vitest";
import { XPlantClient } from "./client.js";
import { XPlantError } from "./errors.js";
import { SensorReadingBuffer } from "./sensor-buffer.js";
import { fakeXPlant } from "./testing/fake-xplant.js";
import type { SensorReading, SensorReadingPayload } from "./types.js";

const reading = (value: number, extra: Partial<SensorReadingPayload> = {}): SensorReadingPayload => ({
  device_id: "d1",
  type: "temperature",
  value,
  unit: "C",
  ...extra,
});

/** A `send` that records batches and can be told to fail. */
function recorder() {
  const batches: SensorReadingPayload[][] = [];
  let failWith: unknown = null;
  const send = vi.fn(async (batch: SensorReadingPayload[]) => {
    batches.push(batch);
    if (failWith) throw failWith;
    return batch as unknown as SensorReading[];
  });
  return {
    send,
    batches,
    fail(error: unknown) {
      failWith = error;
    },
    recover() {
      failWith = null;
    },
  };
}

const quiet = { onError: () => {} };

afterEach(() => {
  vi.useRealTimers();
});

describe("SensorReadingBuffer", () => {
  it("stamps recorded_at and a unique external_id on each reading, keeping any given", async () => {
    const api = recorder();
    const buffer = new SensorReadingBuffer(api.send, { flushIntervalMs: 0, ...quiet });

    buffer.add(reading(1));
    buffer.add(reading(2, { external_id: "mine", recorded_at: "2026-09-25T00:00:00Z" }));
    buffer.add(reading(3, { timestamp: "2026-09-24T00:00:00Z" }));
    await buffer.flush();

    const [first, second, third] = api.batches[0];
    expect(first.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(first.external_id).toMatch(/^xpsdk-[0-9a-f]{32}$/);
    expect(second).toMatchObject({ external_id: "mine", recorded_at: "2026-09-25T00:00:00Z" });
    // The deprecated field becomes the real one, as createBatch() does.
    expect(third.recorded_at).toBe("2026-09-24T00:00:00Z");
    expect(third).not.toHaveProperty("timestamp");
  });

  it("sends in batches of maxBatch", async () => {
    const api = recorder();
    const buffer = new SensorReadingBuffer(api.send, { flushIntervalMs: 0, maxBatch: 2, ...quiet });

    buffer.add(reading(1));
    buffer.add(reading(2)); // reaches maxBatch → sends in the background
    buffer.add(reading(3));
    await buffer.close();

    expect(api.batches.map((b) => b.map((r) => r.value))).toEqual([[1, 2], [3]]);
    expect(buffer.size).toBe(0);
  });

  it("sends on the interval", async () => {
    vi.useFakeTimers();
    const api = recorder();
    const buffer = new SensorReadingBuffer(api.send, { flushIntervalMs: 30_000, ...quiet });

    buffer.add(reading(1));
    await vi.advanceTimersByTimeAsync(29_999);
    expect(api.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.send).toHaveBeenCalledOnce();

    await buffer.close();
  });

  it("keeps readings through a failure and resends them with the same external_ids", async () => {
    const api = recorder();
    const buffer = new SensorReadingBuffer(api.send, { flushIntervalMs: 0, ...quiet });
    buffer.add(reading(1));
    buffer.add(reading(2));

    api.fail(new XPlantError(503, "", "SERVICE_UNAVAILABLE"));
    await expect(buffer.flush()).rejects.toBeInstanceOf(XPlantError);
    expect(buffer.size).toBe(2);

    buffer.add(reading(3));
    api.recover();
    await buffer.flush();

    const [failed, resent] = api.batches;
    expect(resent.map((r) => r.value)).toEqual([1, 2, 3]);
    expect(resent.slice(0, 2).map((r) => r.external_id)).toEqual(failed.map((r) => r.external_id));
  });

  it("reports a background failure and waits for the timer instead of retrying on every add", async () => {
    vi.useFakeTimers();
    const api = recorder();
    const onError = vi.fn();
    const buffer = new SensorReadingBuffer(api.send, { flushIntervalMs: 30_000, maxBatch: 1, onError });

    api.fail(new XPlantError(503, "", "SERVICE_UNAVAILABLE"));
    buffer.add(reading(1));
    await vi.advanceTimersByTimeAsync(0);
    buffer.add(reading(2));
    buffer.add(reading(3));
    await vi.advanceTimersByTimeAsync(0);

    expect(api.send).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.any(XPlantError), { pending: 1, dropped: 0 });
    expect(buffer.size).toBe(3);

    api.recover();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(buffer.size).toBe(0);
    await buffer.close();
  });

  it("drops only the readings the API rejects as invalid, and reports each", async () => {
    const onError = vi.fn();
    const invalid = new XPlantError(422, "", "VALIDATION_ERROR", "value: must be finite");
    const send = vi.fn(async (batch: SensorReadingPayload[]) => {
      if (batch.some((r) => r.value === 999)) throw invalid;
      return batch as unknown as SensorReading[];
    });
    const buffer = new SensorReadingBuffer(send, { flushIntervalMs: 0, onError });

    for (const value of [1, 2, 999, 4, 5]) buffer.add(reading(value));
    const stored = await buffer.flush();

    expect(stored.map((r) => r.value)).toEqual([1, 2, 4, 5]);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(invalid, { pending: 0, dropped: 1 });
  });

  it("drops the oldest readings past maxBuffered, and says so", () => {
    const onError = vi.fn();
    const buffer = new SensorReadingBuffer(recorder().send, {
      flushIntervalMs: 0,
      maxBatch: 10,
      maxBuffered: 10,
      onError,
    });
    // Nothing is sent: maxBatch is only reached by the reading that overflows.
    for (let value = 1; value <= 9; value++) buffer.add(reading(value));
    expect(onError).not.toHaveBeenCalled();

    const blocked = new SensorReadingBuffer(
      async () => {
        throw new XPlantError(503, "");
      },
      { flushIntervalMs: 0, maxBatch: 2, maxBuffered: 3, onError },
    );
    for (let value = 1; value <= 5; value++) blocked.add(reading(value));

    expect(blocked.size).toBeLessThanOrEqual(3);
    expect(onError).toHaveBeenCalledWith(expect.any(RangeError), expect.objectContaining({ dropped: expect.any(Number) }));
  });

  it("refuses add() after close(), and close() keeps what it could not send", async () => {
    const api = recorder();
    const buffer = new SensorReadingBuffer(api.send, { flushIntervalMs: 0, ...quiet });
    buffer.add(reading(1));

    api.fail(new XPlantError(503, ""));
    await expect(buffer.close()).rejects.toBeInstanceOf(XPlantError);
    expect(buffer.size).toBe(1);
    expect(() => buffer.add(reading(2))).toThrow(/after close/);

    api.recover();
    await buffer.flush();
    expect(buffer.size).toBe(0);
  });

  it("posts through the real endpoint with a device token", async () => {
    const server = fakeXPlant({ deviceTokens: { xpd_live_buffer: "d1" } });
    const device = new XPlantClient({
      deviceToken: "xpd_live_buffer",
      baseUrl: "https://api.test",
      fetch: server.fetch,
    });

    const buffer = device.sensorReadings.buffer({ flushIntervalMs: 0, ...quiet });
    buffer.add(reading(21.5));
    await buffer.close();

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].matched?.path).toBe("/api/v1/sensor-readings");
    expect((server.calls[0].body as { readings: unknown[] }).readings).toHaveLength(1);
  });
});
