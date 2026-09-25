import { describe, expect, it } from "vitest";
import { XPlantClient } from "./client.js";
import { MAX_PAGE_SIZE, paginate } from "./paginate.js";
import { fakeXPlant } from "./testing/fake-xplant.js";

/** A list endpoint over `total` numbered rows that honours limit/offset like the API. */
function pagedSource(total: number) {
  const pages: Array<{ limit: number; offset: number }> = [];
  const fetchPage = async (page: { limit: number; offset: number }) => {
    pages.push(page);
    const end = Math.min(total, page.offset + Math.min(page.limit, MAX_PAGE_SIZE));
    return Array.from({ length: Math.max(0, end - page.offset) }, (_, i) => page.offset + i);
  };
  return { fetchPage, pages };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe("paginate", () => {
  it("walks every page and stops at the first short one", async () => {
    const { fetchPage, pages } = pagedSource(450);

    const rows = await collect(paginate(fetchPage));

    expect(rows).toHaveLength(450);
    expect(rows[449]).toBe(449);
    expect(pages).toEqual([
      { limit: 200, offset: 0 },
      { limit: 200, offset: 200 },
      { limit: 200, offset: 400 },
    ]);
  });

  it("asks once more when the last page is exactly full", async () => {
    const { fetchPage, pages } = pagedSource(400);

    expect(await collect(paginate(fetchPage))).toHaveLength(400);
    expect(pages[pages.length - 1]).toEqual({ limit: 200, offset: 400 });
  });

  it("caps pageSize at the API's maximum, so a clamped page is not read as the last", async () => {
    const { fetchPage, pages } = pagedSource(450);

    const rows = await collect(paginate(fetchPage, { pageSize: 1000 }));

    expect(rows).toHaveLength(450);
    expect(pages[0].limit).toBe(MAX_PAGE_SIZE);
  });

  it("starts from an offset and honours a smaller page size", async () => {
    const { fetchPage, pages } = pagedSource(25);

    const rows = await collect(paginate(fetchPage, { pageSize: 10, offset: 5 }));

    expect(rows[0]).toBe(5);
    expect(rows).toHaveLength(20);
    expect(pages.map((p) => p.offset)).toEqual([5, 15, 25]);
  });

  it("stops requesting when the caller breaks out", async () => {
    const { fetchPage, pages } = pagedSource(1000);

    for await (const row of paginate(fetchPage, { pageSize: 50 })) {
      if (row === 60) break;
    }

    expect(pages).toHaveLength(2);
  });

  it("passes limit and offset through a real list method", async () => {
    const server = fakeXPlant({ responses: { "GET /api/v1/events": [] } });
    const client = new XPlantClient({
      apiKey: "xpk_live_test",
      baseUrl: "https://api.test",
      fetch: server.fetch,
    });

    await collect(paginate((page) => client.events.list({ entity: "explant", ...page })));

    expect(server.calls[0].query.get("entity")).toBe("explant");
    expect(server.calls[0].query.get("limit")).toBe("200");
    expect(server.calls[0].query.get("offset")).toBe("0");
  });
});
