import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  Comment,
  CommentCreateInput,
  CommentListParams,
  RequestOptions,
  WriteOptions,
} from "../types.js";

export class CommentsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the comments on one record — a plant, explant, contamination, task,
   * media recipe or SOP.
   * Requires the `read:comments` scope.
   *
   * @example
   * for await (const c of client.comments.list({ entity_type: "explant", entity_id: id })) {
   *   console.log(c.author.name, c.body);
   * }
   */
  list(params: CommentListParams, options?: RequestOptions): ListPromise<Comment> {
    return new ListPromise(
      (page) =>
        this.request<Comment[]>(
          `/api/v1/comments${toQuery({
            entity_type: params.entity_type,
            entity_id: params.entity_id,
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
   * Add a comment to a record, or reply to one with `parent_id`.
   * Requires the `write:comments` scope.
   *
   * Safe to retry with an `Idempotency-Key`. A body containing a signed URL
   * that will expire is refused with 422 — reference the record instead.
   *
   * @example
   * await client.comments.create({
   *   entity_type: "explant",
   *   entity_id: explantId,
   *   body: "Moved to shelf 3 after the second transfer.",
   * });
   */
  async create(input: CommentCreateInput, options?: WriteOptions): Promise<Comment> {
    const { data } = await this.request<Comment>(
      "/api/v1/comments",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
