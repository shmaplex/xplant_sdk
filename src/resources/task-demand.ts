import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type {
  DemandSignalSummary,
  TaskDemandCreateInput,
  TaskDemandListParams,
} from "../types.js";

export class TaskDemandResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List recent demand signals for the workspace, newest first.
   * Requires the `read:tasks` scope.
   *
   * Pass `genus` to narrow to one genus, and `current: true` alongside it to
   * get back only that genus's latest reading (as a single-item array)
   * instead of its history.
   */
  async list(params: TaskDemandListParams = {}): Promise<DemandSignalSummary[]> {
    const { data } = await this.request<DemandSignalSummary[]>(
      `/api/v1/tasks/demand${toQuery({
        genus: params.genus,
        current: params.current === undefined ? undefined : String(params.current),
        limit: params.limit,
        offset: params.offset,
      })}`,
    );
    return data;
  }

  /**
   * Push a demand number for a genus.
   * Requires the `write:demand` scope — kept separate from `write:tasks` so
   * a demand-only integration doesn't also get task write access.
   *
   * @example
   * await client.taskDemand.record({
   *   genus: "Phalaenopsis",
   *   demand_score: 42,
   *   source: "shop-orders",
   * });
   */
  async record(input: TaskDemandCreateInput): Promise<DemandSignalSummary> {
    const { data } = await this.request<DemandSignalSummary>(
      "/api/v1/tasks/demand",
      { method: "POST", body: JSON.stringify(input) },
    );
    return data;
  }
}
