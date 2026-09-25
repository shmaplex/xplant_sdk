/** The largest page any `/api/v1` list endpoint returns. */
export const MAX_PAGE_SIZE = 200;

export interface PaginateOptions {
  /** Rows per request. Defaults to, and is capped at, {@link MAX_PAGE_SIZE}. */
  pageSize?: number;
  /** Where to start. Defaults to 0. */
  offset?: number;
}

/**
 * Walk every page of a list endpoint, yielding one record at a time.
 *
 * The API pages by `limit`/`offset` and returns no total, so this requests
 * pages until one comes back short. Break out of the loop to stop early.
 *
 * Offsets are positions, not bookmarks: records created or deleted while you
 * iterate can shift a row across a page boundary, so it may be skipped or seen
 * twice. For a stable feed of changes, use `events.list({ since })`.
 *
 * @param fetchPage - Called with `{ limit, offset }` for each page. Spread it
 *   into the list call alongside any filters.
 *
 * @example
 * for await (const plant of paginate((page) => client.plants.list(page))) {
 *   console.log(plant.name);
 * }
 *
 * @example
 * const todo = paginate((page) => client.tasks.list({ status: "todo", ...page }));
 */
export async function* paginate<T>(
  fetchPage: (page: { limit: number; offset: number }) => Promise<T[]>,
  options: PaginateOptions = {},
): AsyncGenerator<T, void, undefined> {
  // Asking for more than the cap would get the cap back, and a full page would
  // then read as a short one — ending the walk after the first page.
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(options.pageSize ?? MAX_PAGE_SIZE)),
  );
  let offset = Math.max(0, Math.floor(options.offset ?? 0));

  for (;;) {
    const page = await fetchPage({ limit: pageSize, offset });
    yield* page;
    if (page.length < pageSize) return;
    offset += page.length;
  }
}
