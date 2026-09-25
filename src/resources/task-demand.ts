import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
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
   * const [current] = await client.taskDemand.list({ genus: "Alocasia", current: true });
   */
  list(
    params: TaskDemandListParams = {},
    options?: RequestOptions,
  ): ListPromise<DemandSignalSummary> {
    return new ListPromise(
      (page) =>
        this.request<DemandSignalSummary[]>(
          `/api/v1/tasks/demand${toQuery({
            genus: params.genus,
            current: params.current ? "true" : undefined,
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
   * Push a demand reading for a genus.
   * Requires the `write:demand` scope, which is deliberately separate from
   * `write:tasks` — a demand-only integration does not also get task writes.
   *
   * @example
   * await client.taskDemand.record({
   *   genus: "Alocasia",
   *   demand_score: 42,
   *   source: "web-store",
   * });
   */
  async record(input: TaskDemandCreateInput, options?: WriteOptions): Promise<DemandSignalSummary> {
    const { data } = await this.request<DemandSignalSummary>(
      "/api/v1/tasks/demand",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
