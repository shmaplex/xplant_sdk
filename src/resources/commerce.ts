import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  OrderLine,
  OrderLineListParams,
  RequestOptions,
  SellThroughParams,
  SellThroughRow,
} from "../types.js";

/**
 * Store orders and sell-through, read from a connected store. Requires the
 * `read:commerce` scope, a key whose owner is a manager or above, and a plan
 * that includes pricing — otherwise `402 FEATURE_NOT_INCLUDED`.
 */
export class CommerceResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List store order lines, newest first.
   *
   * @example
   * for await (const line of client.commerce.listOrderLines({ from: "2026-09-01T00:00:00Z" })) {
   *   console.log(line.plant_id, line.quantity, line.unit_price?.amount);
   * }
   */
  listOrderLines(
    params: OrderLineListParams = {},
    options?: RequestOptions,
  ): ListPromise<OrderLine> {
    return new ListPromise(
      (page) =>
        this.request<OrderLine[]>(
          `/api/v1/commerce/order-lines${toQuery({
            from: params.from,
            to: params.to,
            product_link_id: params.product_link_id,
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
   * Units sold and revenue per culture line over a period. One row per culture
   * line and currency: revenue is never added up across currencies.
   * `priced_line_count` says how many order lines carried a price.
   *
   * @example
   * const rows = await client.commerce.getSellThrough({ from: "2026-07-01T00:00:00Z" });
   * for (const row of rows) console.log(row.plant_id, row.units, row.revenue.amount, row.currency);
   */
  getSellThrough(
    params: SellThroughParams = {},
    options?: RequestOptions,
  ): ListPromise<SellThroughRow> {
    return new ListPromise(
      (page) =>
        this.request<SellThroughRow[]>(
          `/api/v1/commerce/sell-through${toQuery({
            from: params.from,
            to: params.to,
            plant_id: params.plant_id,
            limit: page.limit,
            offset: page.offset,
          })}`,
          {},
          options,
        ),
      params,
    );
  }
}
