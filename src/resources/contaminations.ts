import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  Contamination,
  ContaminationCreateInput,
  ContaminationListParams,
  RequestOptions,
  WriteOptions,
} from "../types.js";

export class ContaminationsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the workspace's contamination logs, newest first.
   * Requires the `read:contaminations` scope.
   *
   * Await it for the first page, or iterate it for every log — see
   * {@link ListPromise}.
   *
   * @example
   * for await (const c of client.contaminations.list({ status: "active" })) {
   *   console.log(c.issue, c.severity, c.explant_ids);
   * }
   */
  list(
    params: ContaminationListParams = {},
    options?: RequestOptions,
  ): ListPromise<Contamination> {
    return new ListPromise(
      (page) =>
        this.request<Contamination[]>(
          `/api/v1/contaminations${toQuery({
            plant_id: params.plant_id,
            explant_id: params.explant_id,
            status: params.status,
            since: params.since,
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
   * Get one contamination log.
   * Requires the `read:contaminations` scope.
   *
   * @example
   * const log = await client.contaminations.get(contaminationId);
   */
  async get(contaminationId: string, options?: RequestOptions): Promise<Contamination> {
    const { data } = await this.request<Contamination>(
      `/api/v1/contaminations/${encodeURIComponent(contaminationId)}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Log a contamination against a plant or explant.
   * Requires the `write:contaminations` scope.
   *
   * Safe to retry with an `Idempotency-Key`. A workspace at its plan's limit
   * answers `402 PLAN_LIMIT_REACHED`.
   *
   * @example
   * await client.contaminations.create({
   *   explant_id: explantId,
   *   type: "fungal",
   *   issue: "White fuzz at the media line",
   *   severity: "high",
   *   vessels_affected: 3,
   * });
   */
  async create(input: ContaminationCreateInput, options?: WriteOptions): Promise<Contamination> {
    const { data } = await this.request<Contamination>(
      "/api/v1/contaminations",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
