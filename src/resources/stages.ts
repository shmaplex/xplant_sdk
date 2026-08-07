import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type {
  StageAdvanceInput,
  StageListParams,
  StageSummary,
} from "../types.js";

export class StagesResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List stage history for one plant or explant, most-recent first.
   * Requires the `read:transfers` scope.
   *
   * Pass exactly one of `plant_id` or `explant_id`.
   */
  async list(params: StageListParams): Promise<StageSummary[]> {
    const { data } = await this.request<StageSummary[]>(
      `/api/v1/stages${toQuery({
        plant_id: params.plant_id,
        explant_id: params.explant_id,
        limit: params.limit,
        offset: params.offset,
      })}`,
    );
    return data;
  }

  /**
   * Move a plant or explant to a new tissue-culture stage: completes the
   * current stage, records the new one, and makes it current.
   * Requires the `write:transfers` scope.
   *
   * Pass exactly one of `plant_id` or `explant_id`.
   *
   * @example
   * await client.stages.advance({
   *   explant_id: "uuid",
   *   stage: "rooting",
   * });
   */
  async advance(input: StageAdvanceInput): Promise<StageSummary> {
    const { data } = await this.request<StageSummary>("/api/v1/stages", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data;
  }
}
