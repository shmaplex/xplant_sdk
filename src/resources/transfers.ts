import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type {
  TransferCreateInput,
  TransferListParams,
  TransferSummary,
} from "../types.js";

export class TransfersResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List transfer history for one plant or explant, most-recent first.
   * Requires the `read:transfers` scope.
   *
   * Pass exactly one of `plant_id` or `explant_id`.
   */
  async list(params: TransferListParams): Promise<TransferSummary[]> {
    const { data } = await this.request<TransferSummary[]>(
      `/api/v1/transfers${toQuery({
        plant_id: params.plant_id,
        explant_id: params.explant_id,
        limit: params.limit,
        offset: params.offset,
      })}`,
    );
    return data;
  }

  /**
   * Record a transfer (subculture to fresh media) of a plant or explant.
   * Requires the `write:transfers` scope.
   *
   * Pass exactly one of `plant_id` or `explant_id`. The transfer cycle
   * auto-increments from the entity's last transfer unless supplied.
   *
   * @example
   * await client.transfers.create({
   *   explant_id: "uuid",
   *   to_location: "Shelf 3",
   * });
   */
  async create(input: TransferCreateInput): Promise<TransferSummary> {
    const { data } = await this.request<TransferSummary>("/api/v1/transfers", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data;
  }
}
