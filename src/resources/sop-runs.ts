import type { EnvelopeRequestFn } from "../client.js";
import type {
  RequestOptions,
  SopMeasurementInput,
  SopRun,
  SopRunDetail,
  SopRunStarted,
  SopRunStartInput,
  SopStepEvent,
  SopStepEventInput,
  TrainingWarning,
  WriteOptions,
} from "../types.js";

/** Reads `meta.training_warning` without trusting its shape. */
function readTrainingWarning(meta: Record<string, unknown> | undefined): TrainingWarning | null {
  const warning = meta?.training_warning;
  if (warning === null || typeof warning !== "object") return null;
  const { qualification, expires_on } = warning as Record<string, unknown>;
  if (typeof qualification !== "string") return null;
  return { qualification, expires_on: typeof expires_on === "string" ? expires_on : null };
}

function stepPath(runId: string, stepId: string, kind: "events" | "measurements"): string {
  return `/api/v1/sop-runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/${kind}`;
}

export class SopRunsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Start a run of a protocol, pinned to the version in force.
   * Requires the `write:sop_runs` scope.
   *
   * There is no way to choose the version: a run records what was followed,
   * and that is the version the lab has in force. A protocol with none cannot
   * be run and answers `409 SOP_RUN_NOT_EFFECTIVE`.
   *
   * Training: when the lab blocks on it and the key's owner isn't currently
   * trained on the SOP, this answers `403 TRAINING_REQUIRED`. When the lab only
   * warns — or the owner's training lapses within 30 days — the run starts and
   * `trainingWarning` says why; show it to the operator.
   *
   * Safe to retry with an `Idempotency-Key`.
   *
   * @example
   * const run = await client.sopRuns.start({ sop_id: sopId, batch_code: "B-2026-114" });
   * if (run.trainingWarning) {
   *   console.warn(`Training ${run.trainingWarning.qualification}`, run.trainingWarning.expires_on);
   * }
   */
  async start(input: SopRunStartInput, options?: WriteOptions): Promise<SopRunStarted> {
    const { data, meta } = await this.request<SopRun>(
      "/api/v1/sop-runs",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return { ...data, trainingWarning: readTrainingWarning(meta) };
  }

  /**
   * Get a run, its step states, and the evidence posted against it, oldest
   * first.
   * Requires the `read:sop_runs` scope.
   *
   * @example
   * const run = await client.sopRuns.get(runId);
   * for (const event of run.events) console.log(event.stepKey, event.eventType);
   */
  async get(runId: string, options?: RequestOptions): Promise<SopRunDetail> {
    const { data } = await this.request<SopRunDetail>(
      `/api/v1/sop-runs/${encodeURIComponent(runId)}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Post a confirmation, scan, skip, note or device state against one step.
   * Requires the `write:sop_steps` scope.
   *
   * Append-only: a correction is another event. A run that has ended —
   * completed, failed, cancelled or archived — takes no more evidence and
   * answers `409 SOP_RUN_CLOSED`. A step that is not in the version the run
   * follows answers `404 NOT_FOUND`. Safe to retry with an `Idempotency-Key`.
   *
   * @example
   * await client.sopRuns.recordStepEvent(runId, "step-3", {
   *   event_type: "scanned",
   *   payload: { barcode: "XPL-2025-001" },
   * });
   */
  async recordStepEvent(
    runId: string,
    stepId: string,
    input: SopStepEventInput,
    options?: WriteOptions,
  ): Promise<SopStepEvent> {
    const { data } = await this.request<SopStepEvent>(
      stepPath(runId, stepId, "events"),
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }

  /**
   * Post a numeric reading against one step — from a balance, a pH meter, a
   * probe. Stored on the same trail as the step's other evidence, with
   * `eventType: "measured"`.
   * Requires the `write:sop_steps` scope.
   *
   * `unit` is required: there is no default, because a default would be an
   * assumption written down. The same `404` and `409 SOP_RUN_CLOSED` rules as
   * {@link recordStepEvent} apply. Safe to retry with an `Idempotency-Key`.
   *
   * @example
   * await client.sopRuns.recordMeasurement(runId, "step-4", {
   *   metric: "ph",
   *   value: 5.7,
   *   unit: "pH",
   * });
   */
  async recordMeasurement(
    runId: string,
    stepId: string,
    input: SopMeasurementInput,
    options?: WriteOptions,
  ): Promise<SopStepEvent> {
    const { data } = await this.request<SopStepEvent>(
      stepPath(runId, stepId, "measurements"),
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
