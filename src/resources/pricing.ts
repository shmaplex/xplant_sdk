import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  CultureLinePrice,
  CultureLinePriceListParams,
  PriceEvent,
  PriceEventListParams,
  RequestOptions,
} from "../types.js";

/**
 * Culture line pricing. Requires the `read:pricing` scope, a key whose owner is
 * a manager or above, and a plan that includes pricing — otherwise
 * `402 FEATURE_NOT_INCLUDED`.
 */
export class PricingResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the current price for each culture line. Amounts are exact decimals
   * as text — see {@link Money}.
   *
   * @example
   * for await (const price of client.pricing.listCultureLines()) {
   *   console.log(price.plant_id, price.list_price.amount, price.list_price.currency);
   * }
   */
  listCultureLines(
    params: CultureLinePriceListParams = {},
    options?: RequestOptions,
  ): ListPromise<CultureLinePrice> {
    return new ListPromise(
      (page) =>
        this.request<CultureLinePrice[]>(
          `/api/v1/pricing/culture-lines${toQuery({
            plant_id: params.plant_id,
            pricing_tier: params.pricing_tier,
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
   * List list-price changes, newest first — the history behind
   * {@link listCultureLines}.
   *
   * @example
   * const changes = client.pricing.listEvents({ plant_id: plantId, from: "2026-01-01T00:00:00Z" });
   * for await (const change of changes) console.log(change.changed_at, change.list_price.amount);
   */
  listEvents(params: PriceEventListParams = {}, options?: RequestOptions): ListPromise<PriceEvent> {
    return new ListPromise(
      (page) =>
        this.request<PriceEvent[]>(
          `/api/v1/pricing/events${toQuery({
            plant_id: params.plant_id,
            from: params.from,
            to: params.to,
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
}
