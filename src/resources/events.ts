import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type { EventListParams, EventSummary } from "../types.js";

export class EventsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List change-history events for a plant or explant lineage, oldest first.
   * Requires the `read:events` scope.
   *
   * `entity` is required — plant and explant history live in separate
   * tables, so pull one at a time rather than merging them.
   *
   * Events are immutable and insert-ordered: save the latest `created_at`
   * you received and pass it back as `since` to pull only what's new.
   */
  async list(params: EventListParams): Promise<EventSummary[]> {
    const { data } = await this.request<EventSummary[]>(
      `/api/v1/events${toQuery({
        entity: params.entity,
        since: params.since,
        limit: params.limit,
        offset: params.offset,
      })}`,
    );
    return data;
  }
}
