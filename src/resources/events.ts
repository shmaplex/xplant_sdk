import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
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
   * Events are immutable. To pull deltas on a schedule, iterate from `since`
   * and save the newest `created_at` you received. Start the next pull a little
   * earlier than that — a minute is plenty — and store events keyed by `id`, so
   * reading the overlap twice is harmless: events written together share a
   * timestamp, and one committed late can carry an earlier timestamp than one
   * you have already read.
   *
   * @example
   * // `newest` is the created_at saved by the previous run.
   * const since = new Date(Date.parse(newest) - 60_000).toISOString();
   * for await (const event of client.events.list({ entity: "explant", since })) {
   *   await store.upsert(event.id, event);
   *   if (event.created_at > newest) newest = event.created_at;
   * }
   */
  list(params: EventListParams, options?: RequestOptions): ListPromise<EventSummary> {
    return new ListPromise(
      (page) =>
        this.request<EventSummary[]>(
          `/api/v1/events${toQuery({
            entity: params.entity,
            since: params.since,
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
