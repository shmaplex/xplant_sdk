import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type { PlantListParams, PlantSummary, RequestOptions } from "../types.js";

export class PlantsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List plant summaries for the workspace, newest first.
   * Requires the `read:plants` scope.
   *
   * Pass `external_id` to resolve your own identifier instead of paging — see
   * {@link findByExternalId} for the single-record convenience.
   *
   * The API returns no total — a page shorter than `limit` is the last page.
   *
   * @example
   * const plants = await client.plants.list({ limit: 50, offset: 0 });
   */
  async list(params: PlantListParams = {}, options?: RequestOptions): Promise<PlantSummary[]> {
    const { data } = await this.request<PlantSummary[]>(
      // The wire parameter is camelCase; the field it resolves is `external_id`.
      `/api/v1/plants${toQuery({
        externalId: params.external_id,
        limit: params.limit,
        offset: params.offset,
      })}`,
      {},
      options,
    );
    return data;
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
   * Resolve your own plant identifier (e.g. `"N2001"`) to the record it was
   * imported under, or `null` when nothing matches.
   * Requires the `read:plants` scope.
   *
   * @example
   * const plant = await client.plants.findByExternalId("N2001");
   */
  async findByExternalId(
    externalId: string,
    options?: RequestOptions,
  ): Promise<PlantSummary | null> {
    const matches = await this.list({ external_id: externalId }, options);
    return matches[0] ?? null;
  }
}
