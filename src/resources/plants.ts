import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type { PageParams, PlantSummary } from "../types.js";

export class PlantsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List plant summaries for the workspace, newest first.
   * Requires the `read:plants` scope.
   *
   * The API returns no total — a page shorter than `limit` is the last page.
   */
  async list(params: PageParams = {}): Promise<PlantSummary[]> {
    const { data } = await this.request<PlantSummary[]>(
      `/api/v1/plants${toQuery({ limit: params.limit, offset: params.offset })}`,
    );
    return data;
  }

  /**
   * Get a single plant by ID.
   * Requires the `read:plants` scope.
   */
  async get(plantId: string): Promise<PlantSummary> {
    const { data } = await this.request<PlantSummary>(
      `/api/v1/plants/${encodeURIComponent(plantId)}`,
    );
    return data;
  }
}
