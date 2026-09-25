import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  Asset,
  AssetCreateInput,
  AssetListParams,
  RequestOptions,
  WriteOptions,
} from "../types.js";

export class AssetsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the photos and media attached to one record.
   * Requires the `read:assets` scope.
   *
   * Each asset's `view_url` works for about 15 minutes. Fetch it again for a
   * fresh link rather than storing one.
   *
   * @example
   * for await (const photo of client.assets.list({ target: "explant", target_id: id })) {
   *   console.log(photo.caption, photo.view_url);
   * }
   */
  list(params: AssetListParams, options?: RequestOptions): ListPromise<Asset> {
    return new ListPromise(
      (page) =>
        this.request<Asset[]>(
          `/api/v1/assets${toQuery({
            target: params.target,
            target_id: params.target_id,
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
   * Get one asset, with a fresh `view_url`.
   * Requires the `read:assets` scope.
   *
   * @example
   * const { view_url } = await client.assets.get(assetId);
   */
  async get(assetId: string, options?: RequestOptions): Promise<Asset> {
    const { data } = await this.request<Asset>(
      `/api/v1/assets/${encodeURIComponent(assetId)}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Attach an image to a plant, explant, contamination or SOP — either from a
   * URL the API fetches, or as base64.
   * Requires the `write:assets` scope.
   *
   * Safe to retry with an `Idempotency-Key`. A file that is too large answers
   * `413 PAYLOAD_TOO_LARGE`, an unsupported type `415 UNSUPPORTED_MEDIA_TYPE`,
   * and a URL that could not be fetched `422 IMAGE_URL_FETCH_FAILED`.
   *
   * @example
   * await client.assets.create({
   *   target: "explant",
   *   target_id: explantId,
   *   image_url: "https://example.com/photos/jar-12.jpg",
   *   caption: "Week 3, jar 12",
   * });
   */
  async create(input: AssetCreateInput, options?: WriteOptions): Promise<Asset> {
    const { data } = await this.request<Asset>(
      "/api/v1/assets",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
