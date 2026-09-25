import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  PlantCreateInput,
  PlantCreateResult,
  PlantListParams,
  PlantSummary,
  PlantUpdateInput,
  RequestOptions,
  WriteOptions,
} from "../types.js";

export class PlantsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List plant summaries for the workspace, newest first.
   * Requires the `read:plants` scope.
   *
   * Pass `external_id` to resolve your own identifier instead of paging — see
   * {@link findByExternalId} for the single-record convenience.
   *
   * Await it for the first page, or iterate it for every plant — see
   * {@link ListPromise}.
   *
   * @example
   * const firstPage = await client.plants.list({ limit: 50 });
   *
   * @example
   * for await (const plant of client.plants.list()) {
   *   console.log(plant.name);
   * }
   */
  list(params: PlantListParams = {}, options?: RequestOptions): ListPromise<PlantSummary> {
    return new ListPromise(
      (page) =>
        this.request<PlantSummary[]>(
          // The wire parameter is camelCase; the field it resolves is `external_id`.
          `/api/v1/plants${toQuery({
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
   * Get a single plant by its xPlant id.
   * Requires the `read:plants` scope.
   *
   * A plant in another workspace answers 404, not 403.
   *
   * @example
   * const plant = await client.plants.get(plantId);
   */
  async get(plantId: string, options?: RequestOptions): Promise<PlantSummary> {
    const { data } = await this.request<PlantSummary>(
      `/api/v1/plants/${encodeURIComponent(plantId)}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Create a plant.
   * Requires the `write:plants` scope.
   *
   * Safe to retry with an `Idempotency-Key`. An `external_id` already in use
   * answers `409 DUPLICATE_ENTRY`; a workspace at its plan's plant limit
   * answers `402 PLAN_LIMIT_REACHED`.
   *
   * Resolves with the plant and a `warning`, set only when the plant was saved
   * but its first stage could not be — record one with `stages.advance()`.
   *
   * @example
   * const { plant } = await client.plants.create({
   *   species: "Alocasia zebrina",
   *   external_id: "LINE-0412",
   *   initial_stage: "Mother Block",
   * });
   */
  async create(input: PlantCreateInput, options?: WriteOptions): Promise<PlantCreateResult> {
    const { data, meta } = await this.request<PlantSummary>(
      "/api/v1/plants",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    const warning = meta?.warning;
    return { plant: data, warning: typeof warning === "string" ? warning : null };
  }

  /**
   * Update a plant. Only the fields you send change.
   * Requires the `write:plants` scope.
   *
   * A teammate's plant needs its creator or a manager, or answers
   * `403 PLANT_WRITE_FORBIDDEN`.
   *
   * @example
   * await client.plants.update(plantId, { status: "in_culture", custom_fields: { tray: "B4" } });
   */
  async update(
    plantId: string,
    input: PlantUpdateInput,
    options?: WriteOptions,
  ): Promise<PlantSummary> {
    const { data } = await this.request<PlantSummary>(
      `/api/v1/plants/${encodeURIComponent(plantId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
      options,
    );
    return data;
  }

  /**
   * Resolve your own plant identifier (e.g. `"LINE-0412"`) to the record it was
   * imported under, or `null` when nothing matches.
   * Requires the `read:plants` scope.
   *
   * @example
   * const plant = await client.plants.findByExternalId("LINE-0412");
   */
  async findByExternalId(
    externalId: string,
    options?: RequestOptions,
  ): Promise<PlantSummary | null> {
    const matches = await this.list({ external_id: externalId }, options);
    return matches[0] ?? null;
  }
}
