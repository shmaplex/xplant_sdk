import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type {
  DemandSignalSummary,
  RequestOptions,
  TaskDemandCreateInput,
  TaskDemandListParams,
  WriteOptions,
} from "../types.js";

export class TaskDemandResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List demand signals for the workspace, newest first.
   * Requires the `read:tasks` scope.
   *
   * Pass `{ genus, current: true }` for the single current reading of one
   * genus instead of its history — the number to check before deciding
   * whether to push a new one.
   *
   * @example
   * const [current] = await client.taskDemand.list({ genus: "Nepenthes", current: true });
   */
  async list(
    params: TaskDemandListParams = {},
    options?: RequestOptions,
  ): Promise<DemandSignalSummary[]> {
    const { data } = await this.request<DemandSignalSummary[]>(
      `/api/v1/tasks/demand${toQuery({
        genus: params.genus,
        current: params.current ? "true" : undefined,
        limit: params.limit,
        offset: params.offset,
      })}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Push a demand reading for a genus.
   * Requires the `write:demand` scope, which is deliberately separate from
   * `write:tasks` — a demand-only integration does not also get task writes.
   *
   * @example
   * await client.taskDemand.record({
   *   genus: "Nepenthes",
   *   demand_score: 42,
   *   source: "web-store",
   * });
   */
  async record(input: TaskDemandCreateInput, options?: WriteOptions): Promise<DemandSignalSummary> {
    const { data } = await this.request<DemandSignalSummary>(
      "/api/v1/tasks/demand",
      { method: "POST", body: JSON.stringify(input) },
      options,
    );
    return data;
  }
}
