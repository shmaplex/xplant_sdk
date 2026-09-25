import type { EnvelopeRequestFn } from "../client.js";
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
  async list(params: StageListParams, options?: RequestOptions): Promise<StageSummary[]> {
    const { data } = await this.request<StageSummary[]>(
      `/api/v1/stages${toQuery({
        plant_id: params.plant_id,
        explant_id: params.explant_id,
        limit: params.limit,
        offset: params.offset,
      })}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Move a plant or explant to a new tissue-culture stage. Completes the
   * current stage, records the new one, and makes it current.
   * Requires the `write:transfers` scope.
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
      options,
    );
    return data;
  }
}
