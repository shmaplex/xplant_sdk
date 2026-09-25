import { XPlantError } from "./errors.js";
import { newIdempotencyKey } from "./retry.js";
import type { SensorReading, SensorReadingPayload } from "./types.js";

/** The most readings one request may carry. */
export const MAX_SENSOR_BATCH = 500;

export interface SensorBufferOptions {
  /** Send as soon as this many readings are waiting. Defaults to, and is capped at, 500. */
  maxBatch?: number;
  /** Send whatever is waiting at least this often, in ms. Defaults to 30 000. `0` sends only on `maxBatch` and `flush()`. */
  flushIntervalMs?: number;
  /**
   * Most readings held while the API cannot be reached. Past it, the oldest are
   * dropped and reported to `onError`. Defaults to 10 000.
   */
  maxBuffered?: number;
  /**
   * Called when a background send fails (the readings stay queued and are sent
   * again later) or when readings are dropped. Defaults to `console.warn`.
   */
  onError?: (error: unknown, context: { pending: number; dropped: number }) => void;
}

type SendBatch = (readings: SensorReadingPayload[]) => Promise<SensorReading[]>;

/** 400 and 422 mean the request itself is wrong: resending it unchanged cannot succeed. */
function isRejectedAsInvalid(error: unknown): boolean {
  return error instanceof XPlantError && (error.status === 400 || error.status === 422);
}

/**
 * Batches sensor readings on a device and sends them in the background.
 *
 * Every reading gets a `recorded_at` when it is added and an `external_id`
 * unless it has one, so a batch resent after a failure is recognised by the API
 * and stored once. Readings that could not be sent stay queued, in order, and
 * go out with the next send. A reading the API rejects as invalid is dropped
 * and reported, so one bad value cannot block the rest.
 *
 * The buffer lives in memory: call {@link close} before the process exits, or
 * whatever is still queued is lost.
 *
 * @example
 * const buffer = device.sensorReadings.buffer({
 *   onError: (err, { pending }) => console.warn(`send failed, ${pending} queued`, err),
 * });
 * buffer.add({ device_id: deviceId, type: "temperature", value: 23.4, unit: "C" });
 * // …on shutdown:
 * await buffer.close();
 */
export class SensorReadingBuffer {
  private queue: SensorReadingPayload[] = [];
  private inFlight: Promise<SensorReading[]> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Set when a background send fails; cleared by the next timer tick. */
  private backingOff = false;
  private closed = false;
  private readonly maxBatch: number;
  private readonly maxBuffered: number;
  private readonly onError: NonNullable<SensorBufferOptions["onError"]>;

  constructor(
    private readonly send: SendBatch,
    options: SensorBufferOptions = {},
  ) {
    this.maxBatch = Math.min(MAX_SENSOR_BATCH, Math.max(1, Math.floor(options.maxBatch ?? MAX_SENSOR_BATCH)));
    this.maxBuffered = Math.max(this.maxBatch, Math.floor(options.maxBuffered ?? 10_000));
    this.onError =
      options.onError ??
      ((error, { pending, dropped }) =>
        console.warn(`[xplant-sdk] sensor buffer: ${pending} pending, ${dropped} dropped`, error));

    const interval = options.flushIntervalMs ?? 30_000;
    if (interval > 0) {
      this.timer = setInterval(() => this.flushInBackground(true), interval);
      // Do not keep a Node process alive just to wait for the next tick.
      (this.timer as { unref?: () => void }).unref?.();
    }
  }

  /** Readings waiting to be sent, not counting a batch already on its way. */
  get size(): number {
    return this.queue.length;
  }

  /** Queue a reading. Sends in the background once `maxBatch` are waiting. */
  add(reading: SensorReadingPayload): void {
    if (this.closed) throw new Error("SensorReadingBuffer: add() called after close()");
    const { timestamp, ...rest } = reading;
    this.queue.push({
      ...rest,
      recorded_at: reading.recorded_at ?? timestamp ?? new Date().toISOString(),
      external_id: reading.external_id ?? newIdempotencyKey(),
    });
    this.enforceCap();
    if (this.queue.length >= this.maxBatch) this.flushInBackground(false);
  }

  /**
   * Send everything queued now, in batches of `maxBatch`. Resolves with the
   * readings the API stored; rejects when a send fails, leaving the unsent
   * readings queued.
   */
  flush(): Promise<SensorReading[]> {
    const previous = this.inFlight ?? Promise.resolve([]);
    const run = previous.catch(() => []).then(() => this.drain());
    this.inFlight = run;
    run.then(
      () => this.settle(run),
      () => this.settle(run),
    );
    return run;
  }

  /** Stop the timer and send what is left. Rejects if that final send fails; the readings stay in `size`. */
  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }

  private settle(run: Promise<SensorReading[]>): void {
    if (this.inFlight === run) this.inFlight = null;
  }

  private flushInBackground(fromTimer: boolean): void {
    if (fromTimer) this.backingOff = false;
    // After a failure, wait for the timer rather than retrying on every add().
    if (this.inFlight || this.backingOff || this.queue.length === 0) return;
    this.flush().catch((error: unknown) => {
      this.backingOff = true;
      this.onError(error, { pending: this.queue.length, dropped: 0 });
    });
  }

  private async drain(): Promise<SensorReading[]> {
    const stored: SensorReading[] = [];
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxBatch);
      let result: SensorReading[];
      try {
        result = await this.sendOrSplit(batch);
      } catch (error) {
        // Back at the front, with the same external_ids, so a resend of a batch
        // that did land is stored once.
        this.queue.unshift(...batch);
        this.enforceCap();
        throw error;
      }
      if (Array.isArray(result)) stored.push(...result);
    }
    return stored;
  }

  /** Sends a batch; when the API rejects it as invalid, halves it until the bad readings are isolated. */
  private async sendOrSplit(batch: SensorReadingPayload[]): Promise<SensorReading[]> {
    try {
      return await this.send(batch);
    } catch (error) {
      if (!isRejectedAsInvalid(error)) throw error;
      if (batch.length === 1) {
        this.onError(error, { pending: this.queue.length, dropped: 1 });
        return [];
      }
      const middle = Math.ceil(batch.length / 2);
      const first = await this.sendOrSplit(batch.slice(0, middle));
      const second = await this.sendOrSplit(batch.slice(middle));
      return [...first, ...second];
    }
  }

  private enforceCap(): void {
    const excess = this.queue.length - this.maxBuffered;
    if (excess <= 0) return;
    this.queue.splice(0, excess);
    this.onError(
      new RangeError(
        `SensorReadingBuffer: dropped the ${excess} oldest reading(s) — more than ${this.maxBuffered} were waiting to be sent`,
      ),
      { pending: this.queue.length, dropped: excess },
    );
  }
}
