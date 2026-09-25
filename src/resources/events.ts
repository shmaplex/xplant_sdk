import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type { EventListParams, EventSummary, RequestOptions } from "../types.js";

export class EventsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List change history for the workspace, oldest first.
   * Requires the `read:events` scope.
   *
   * `entity` is required. Plant and explant history are paged independently,
   * so there is no combined feed — call once per entity type.
   *
   * Events are immutable and insert-ordered. To pull deltas on a schedule,
   * save the newest `created_at` you received and pass it back as `since`.
   *
   * @example
   * let since: string | undefined;
   * const batch = await client.events.list({ entity: "explant", since });
   * since = batch.at(-1)?.created_at ?? since;
   */
  async list(params: EventListParams, options?: RequestOptions): Promise<EventSummary[]> {
    const { data } = await this.request<EventSummary[]>(
      `/api/v1/events${toQuery({
        entity: params.entity,
        since: params.since,
        limit: params.limit,
        offset: params.offset,
      })}`,
      {},
      options,
    );
    return data;
  }
}
