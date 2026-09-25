import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  ExplantCreateInput,
  ExplantListParams,
  ExplantSummary,
  ExplantUpdateInput,
  RequestOptions,
  WriteOptions,
} from "../types.js";

export class ExplantsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List explant (batch) summaries for the workspace, newest first.
   * Requires the `read:explants` scope.
   *
   * Pass `external_id` to resolve your own batch identifier instead of paging.
   * The API answers with an array either way, so the return type does not
   * change with the query — see {@link findByExternalId} for the single-record
   * convenience.
   *
   * Await it for the first page, or iterate it for every batch — see
   * {@link ListPromise}.
   *
   * @example
   * for await (const batch of client.explants.list()) {
   *   console.log(batch.external_id, batch.current_count);
   * }
   */
  list(params: ExplantListParams = {}, options?: RequestOptions): ListPromise<ExplantSummary> {
    return new ListPromise(
      (page) =>
        this.request<ExplantSummary[]>(
          // The wire parameter is camelCase; the field it resolves is `external_id`.
          `/api/v1/explants${toQuery({
            externalId: params.external_id,
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
   * Get a single explant by its xPlant id.
   * Requires the `read:explants` scope.
   *
   * A batch in another workspace answers 404, not 403 — the API will not
   * confirm that an id exists elsewhere.
   *
   * @example
   * const batch = await client.explants.get(explantId);
   */
  async get(explantId: string, options?: RequestOptions): Promise<ExplantSummary> {
    const { data } = await this.request<ExplantSummary>(
      `/api/v1/explants/${encodeURIComponent(explantId)}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Create an explant (batch).
   * Requires the `write:explants` scope.
   *
   * Safe to retry with an `Idempotency-Key`. An `external_id` already in use
   * answers `409 DUPLICATE_ENTRY`; a workspace at its plan's limit answers
   * `402 PLAN_LIMIT_REACHED`.
   *
   * @example
   * const batch = await client.explants.create({
   *   label: "B-2026-114",
   *   plant_id: plantId,
   *   external_id: "B-2026-114",
   * });
   */
  async create(input: ExplantCreateInput, options?: WriteOptions): Promise<ExplantSummary> {
    const { data } = await this.request<ExplantSummary>(
      "/api/v1/explants",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }

  /**
   * Update an explant. Only the fields you send change.
   * Requires the `write:explants` scope.
   *
   * A teammate's explant needs its creator or a manager, or answers
   * `403 EXPLANT_WRITE_FORBIDDEN`.
   *
   * @example
   * await client.explants.update(explantId, { status: "needs_subculture" });
   */
  async update(
    explantId: string,
    input: ExplantUpdateInput,
    options?: WriteOptions,
  ): Promise<ExplantSummary> {
    const { data } = await this.request<ExplantSummary>(
      `/api/v1/explants/${encodeURIComponent(explantId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
      options,
    );
    return data;
  }

  /**
   * Resolve your own batch identifier (e.g. `"LINE-0412"`) to the record it was
   * imported under, or `null` when nothing matches.
   * Requires the `read:explants` scope.
   *
   * Unlike {@link get}, a miss is `null` rather than a thrown 404 — looking up
   * a code that may not have been imported yet is a normal outcome, not an
   * error.
   *
   * @example
   * const batch = await client.explants.findByExternalId("LINE-0412");
   */
  async findByExternalId(
    externalId: string,
    options?: RequestOptions,
  ): Promise<ExplantSummary | null> {
    const matches = await this.list({ external_id: externalId }, options);
    return matches[0] ?? null;
  }
}
