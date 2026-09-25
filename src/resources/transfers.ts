import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  RequestOptions,
  TransferCreateInput,
  TransferListParams,
  TransferSummary,
  WriteOptions,
} from "../types.js";

export class TransfersResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the transfer history of one plant or explant, most recent first.
   * Requires the `read:transfers` scope.
   *
   * Give exactly one of `plant_id` or `explant_id`. An id outside the
   * workspace answers 404, not 403.
   *
   * @example
   * const transfers = await client.transfers.list({ explant_id: explantId });
   */
  list(params: TransferListParams, options?: RequestOptions): ListPromise<TransferSummary> {
    return new ListPromise(
      (page) =>
        this.request<TransferSummary[]>(
          `/api/v1/transfers${toQuery({
            plant_id: params.plant_id,
            explant_id: params.explant_id,
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
   * Record a transfer — a subculture onto fresh media.
   * Requires the `write:transfers` scope.
   *
   * `transfer_cycle` continues from the last cycle recorded for that plant or
   * explant when you omit it, so a device posting on a schedule does not have
   * to track the count itself. `status` is `"completed"` by default; send
   * `"pending"` for a transfer that is planned but not done. Each transfer also
   * appears in `events.list()` as a `transfer` event.
   *
   * @example
   * await client.transfers.create({
   *   explant_id: explantId,
   *   to_location: "Shelf 3",
   *   notes: "Clean, no browning",
   * });
   */
  async create(input: TransferCreateInput, options?: WriteOptions): Promise<TransferSummary> {
    const { data } = await this.request<TransferSummary>(
      "/api/v1/transfers",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
