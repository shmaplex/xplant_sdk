import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  RequestOptions,
  StageAdvanceInput,
  StageListParams,
  StageSummary,
  WriteOptions,
} from "../types.js";

export class StagesResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the stage history of one plant or explant, most recent first.
   * Requires the `read:transfers` scope — stages and transfers share a scope.
   *
   * Give exactly one of `plant_id` or `explant_id`. An id outside the
   * workspace answers 404, not 403.
   *
   * @example
   * const history = await client.stages.list({ explant_id: explantId, limit: 20 });
   */
  list(params: StageListParams, options?: RequestOptions): ListPromise<StageSummary> {
    return new ListPromise(
      (page) =>
        this.request<StageSummary[]>(
          `/api/v1/stages${toQuery({
            plant_id: params.plant_id,
            explant_id: params.explant_id,
            limit: page.limit,
            offset: page.offset,
            cursor: page.cursor,
          })}`,
          {},
          options,
        ),
      params,
    );
  }

  /**
   * Move a plant or explant to a new tissue-culture stage. Completes the
   * current stage, records the new one, and makes it current.
   * Requires the `write:transfers` scope.
   *
   * `stage` must be in the lab's own stage list for plants or explants; the
   * result carries the stage's key (`"Multiplication"` comes back as
   * `"multiplication"`). A stage the lab doesn't use answers
   * `422 VALIDATION_ERROR`. Moving a teammate's plant or explant needs its
   * creator or a manager, or answers `403 STAGE_WRITE_FORBIDDEN`. Each move
   * also appears in `events.list()` as a `stage_change` event.
   *
   * A move either happens completely or not at all: `500 STAGE_ADVANCE_FAILED`
   * means nothing moved — the plant or explant is still in its old stage — and
   * it is safe to retry with the same `Idempotency-Key`.
   *
   * @example
   * await client.stages.advance({
   *   explant_id: explantId,
   *   stage: "multiplication",
   *   notes: "Second pass, 12 jars",
   * });
   */
  async advance(input: StageAdvanceInput, options?: WriteOptions): Promise<StageSummary> {
    const { data } = await this.request<StageSummary>(
      "/api/v1/stages",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
