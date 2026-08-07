import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type { ExplantListParams, ExplantSummary } from "../types.js";

export class ExplantsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List explant (batch) summaries for the workspace, newest first.
   * Requires the `read:explants` scope.
   *
   * Pass `externalId` to resolve the customer's own batch identifier (e.g.
   * "N2001") to the record it was imported under — at most one row comes
   * back, but the response is still an array. Otherwise `limit`/`offset`
   * page the workspace's explants same as every other v1 list endpoint.
   */
  async list(params: ExplantListParams = {}): Promise<ExplantSummary[]> {
    const { data } = await this.request<ExplantSummary[]>(
      `/api/v1/explants${toQuery({
        externalId: params.externalId,
        limit: params.limit,
        offset: params.offset,
      })}`,
    );
    return data;
  }

  /**
   * Get a single explant by ID.
   * Requires the `read:explants` scope.
   *
   * Throws {@link XPlantError} with status 404 for an id outside the
   * workspace, so a key cannot be used to probe which ids exist elsewhere.
   */
  async get(explantId: string): Promise<ExplantSummary> {
    const { data } = await this.request<ExplantSummary>(
      `/api/v1/explants/${encodeURIComponent(explantId)}`,
    );
    return data;
  }
}
