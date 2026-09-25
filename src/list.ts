import type { PageParams, XPlantApiResponse } from "./types.js";

/** The largest page any `/api/v1` list endpoint returns. */
export const MAX_PAGE_SIZE = 200;

/** The page size the API uses when no `limit` is sent. */
const DEFAULT_PAGE_SIZE = 50;

/** One page of a list, as yielded by `ListPromise.pages()`. */
export interface ListPage<T> {
  data: T[];
  /**
   * Pass back as `cursor` to continue from the page after this one — now, or
   * in a later run. `null` on the last page, and on endpoints that still page
   * by offset.
   */
  nextCursor: string | null;
  /** Whether another page follows. */
  hasMore: boolean;
  /** The API's id for the request that fetched this page, from `X-Request-Id`. */
  requestId: string | null;
}

/** How a list pages when the endpoint returns no cursor. */
export interface ListPromiseOptions {
  /**
   * Fall back to offset paging when a page carries no `meta.next_cursor`.
   * Endpoints that never honoured `offset` set this to `false`, so a response
   * without a cursor is treated as the only page instead of being re-requested
   * at ever-larger offsets.
   */
  offsetFallback?: boolean;
}

/** Where a page starts: a cursor the API issued, or an offset. */
export interface PageRequest {
  limit?: number;
  offset?: number;
  cursor?: string;
}

type PageLoader<T> = (page: PageRequest) => Promise<XPlantApiResponse<T[]>>;

/**
 * The cursor for the next page: a string to continue, `null` when this is the
 * last page, or `undefined` when the endpoint does not page by cursor.
 */
function readNextCursor(meta: Record<string, unknown> | undefined): string | null | undefined {
  if (!meta || !("next_cursor" in meta)) return undefined;
  const value = meta.next_cursor;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** The page size the API will actually use for `limit`, mirroring its clamp. */
function effectivePageSize(limit: number | undefined): number {
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0
    ? Math.min(Math.floor(limit), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
}

/**
 * What a list method returns: a promise of the first page that can also walk
 * every page.
 *
 * - `await client.plants.list()` resolves to the first page, as an array.
 * - `for await (const plant of client.plants.list())` yields every record,
 *   fetching pages as it goes. Break out of the loop to stop early.
 * - `for await (const page of client.plants.list().pages())` yields whole
 *   pages, each with the cursor to resume from.
 *
 * Pages are followed by the cursor the API returns in `meta.next_cursor`. An
 * endpoint that does not return one yet is paged by offset instead, so the
 * same code keeps working as endpoints move to cursors.
 *
 * Like any promise, the first page is requested straight away, so lists
 * started together load in parallel. Later pages are requested only as the
 * iteration reaches them.
 */
export class ListPromise<T> implements Promise<T[]>, AsyncIterable<T> {
  readonly [Symbol.toStringTag] = "Promise";
  private readonly first: Promise<XPlantApiResponse<T[]>>;

  constructor(
    private readonly load: PageLoader<T>,
    private readonly start: PageParams,
    private readonly listOptions: ListPromiseOptions = {},
  ) {
    this.first = load({ limit: start.limit, offset: start.offset, cursor: start.cursor }).then(
      (envelope) => {
        if (start.cursor !== undefined && readNextCursor(envelope.meta) === undefined) {
          // The endpoint ignored the cursor and answered from the top. Handing
          // that back as "the next page" would silently repeat records.
          throw new Error(
            "This endpoint does not page by cursor yet, so the cursor was ignored. Page with limit and offset instead.",
          );
        }
        return envelope;
      },
    );
    // Every consumer chains its own handler off `first` and sees the failure.
    // This one only keeps a list nobody awaited from crashing the process with
    // an unhandled rejection.
    this.first.catch(() => {});
  }

  private firstPage(): Promise<XPlantApiResponse<T[]>> {
    return this.first;
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.firstPage()
      .then((envelope) => (Array.isArray(envelope.data) ? envelope.data : []))
      .then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T[] | TResult> {
    return this.then(undefined, onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T[]> {
    return this.then().finally(onfinally);
  }

  /** Every page, starting from the first, each with the cursor to resume from. */
  async *pages(): AsyncGenerator<ListPage<T>, void, undefined> {
    const { limit } = this.start;
    const pageSize = effectivePageSize(limit);
    let offset = Math.max(0, Math.floor(this.start.offset ?? 0));
    let envelope = await this.firstPage();

    for (;;) {
      const data = Array.isArray(envelope.data) ? envelope.data : [];
      const cursor = readNextCursor(envelope.meta);
      const offsetFallback = this.listOptions.offsetFallback !== false;
      // Offset paging has no cursor, so a full page is the only sign of more.
      const hasMore =
        data.length > 0 &&
        (cursor === undefined ? offsetFallback && data.length >= pageSize : cursor !== null);

      yield { data, nextCursor: cursor ?? null, hasMore, requestId: envelope.requestId ?? null };
      if (!hasMore) return;

      if (typeof cursor === "string") {
        envelope = await this.load({ limit, cursor });
      } else {
        offset += data.length;
        envelope = await this.load({ limit, offset });
      }
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    for await (const page of this.pages()) yield* page.data;
  }
}
