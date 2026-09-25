import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type { ExplantListParams, ExplantSummary, RequestOptions } from "../types.js";

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
   * The API returns no total — a page shorter than `limit` is the last page.
   *
   * @example
   * const batches = await client.explants.list({ limit: 50 });
   */
  async list(params: ExplantListParams = {}, options?: RequestOptions): Promise<ExplantSummary[]> {
    const { data } = await this.request<ExplantSummary[]>(
      // The wire parameter is camelCase; the field it resolves is `external_id`.
      `/api/v1/explants${toQuery({
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
   * Resolve your own batch identifier (e.g. `"N2001"`) to the record it was
   * imported under, or `null` when nothing matches.
   * Requires the `read:explants` scope.
   *
   * Unlike {@link get}, a miss is `null` rather than a thrown 404 — looking up
   * a code that may not have been imported yet is a normal outcome, not an
   * error.
   *
   * @example
   * const batch = await client.explants.findByExternalId("N2001");
   */
  async findByExternalId(
    externalId: string,
    options?: RequestOptions,
  ): Promise<ExplantSummary | null> {
    const matches = await this.list({ external_id: externalId }, options);
    return matches[0] ?? null;
  }
}
