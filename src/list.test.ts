import { describe, expect, it } from "vitest";
import { XPlantClient } from "./client.js";
import { XPlantError } from "./errors.js";
import { ListPromise, MAX_PAGE_SIZE } from "./list.js";

/**
 * A stub `/api/v1/plants` over `total` numbered rows. It honours `limit` and
 * `offset` the way the API does today, and — with `cursors: true` — pages by
 * cursor the way the API will: `meta.next_cursor` on every page, computed from
 * limit + 1 rows, `null` on the last page.
 */
function plantsApi(total: number, { cursors = false } = {}) {
  const requests: URLSearchParams[] = [];
  const fetchImpl = (input: string) => {
    const query = new URL(input).searchParams;
    requests.push(query);
    const rawLimit = Number(query.get("limit"));
    const limit = rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : 50;
    const cursor = query.get("cursor");
    if (cursor !== null && !/^c\d+$/.test(cursor)) {
      const body = { ok: false, data: null, error: "Invalid cursor", code: "INVALID_CURSOR" };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 422 }));
    }
    const start = cursor !== null ? Number(cursor.slice(1)) : Number(query.get("offset") ?? 0);
    const rows = Array.from({ length: Math.max(0, Math.min(total, start + limit) - start) }, (_, i) => ({
      id: `p${start + i}`,
    }));
    const meta = cursors ? { next_cursor: start + limit < total ? `c${start + limit}` : null } : undefined;
    return Promise.resolve(new Response(JSON.stringify({ ok: true, data: rows, ...(meta ? { meta } : {}) })));
  };
  const client = new XPlantClient({
    apiKey: "xpk_live_test",
    baseUrl: "https://api.test",
    fetch: fetchImpl as unknown as typeof fetch,
  });
  return { client, requests };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe("awaiting a list", () => {
  it("resolves to the first page only, as before", async () => {
    const { client, requests } = plantsApi(450);

    const page = await client.plants.list({ limit: 100 });

    expect(page).toHaveLength(100);
    expect(requests).toHaveLength(1);
  });

  it("starts the first request straight away, so lists load in parallel", () => {
    const { client, requests } = plantsApi(10);

    const plants = client.plants.list();
    const tasks = client.tasks.list();

    expect(requests).toHaveLength(2);
    return Promise.all([plants, tasks]);
  });

  it("does not raise an unhandled rejection for a list nobody awaited", async () => {
    // Vitest runs on Node; the repo carries no Node typings, so name only what is used.
    const node = (globalThis as unknown as {
      process: {
        on(event: string, fn: (reason: unknown) => void): void;
        off(event: string, fn: (reason: unknown) => void): void;
      };
    }).process;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    node.on("unhandledRejection", onUnhandled);
    try {
      const client = new XPlantClient({
        apiKey: "xpk_live_test",
        baseUrl: "https://api.test",
        fetch: (() => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch,
      });
      client.plants.list();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unhandled).toEqual([]);
    } finally {
      node.off("unhandledRejection", onUnhandled);
    }
  });

  it("is a Promise to code that expects one", async () => {
    const { client } = plantsApi(3);
    const list: Promise<unknown[]> = client.plants.list();

    await expect(list).resolves.toHaveLength(3);
    await expect(Promise.all([client.plants.list(), client.plants.list()])).resolves.toHaveLength(2);
  });
});

describe("iterating a list by offset (endpoints without cursors)", () => {
  it("walks every page and stops at the first short one", async () => {
    const { client, requests } = plantsApi(450);

    const plants = await collect(client.plants.list({ limit: 200 }));

    expect(plants).toHaveLength(450);
    expect(plants[449]).toEqual({ id: "p449" });
    expect(requests.map((q) => q.get("offset"))).toEqual([null, "200", "400"]);
  });

  it("asks once more when the last page is exactly full", async () => {
    const { client, requests } = plantsApi(400);

    expect(await collect(client.plants.list({ limit: 200 }))).toHaveLength(400);
    expect(requests).toHaveLength(3);
  });

  it("uses the API's default page size when no limit is given", async () => {
    const { client, requests } = plantsApi(120);

    expect(await collect(client.plants.list())).toHaveLength(120);
    expect(requests.map((q) => q.get("offset"))).toEqual([null, "50", "100"]);
  });

  it("treats a limit above the cap as the cap, so a clamped page is not read as the last", async () => {
    const { client } = plantsApi(450);
    expect(await collect(client.plants.list({ limit: 1000 }))).toHaveLength(450);
  });

  it("does not loop on a limit the API ignores", async () => {
    const { client } = plantsApi(120);
    expect(await collect(client.plants.list({ limit: 0 }))).toHaveLength(120);
  });

  it("starts from an offset", async () => {
    const { client } = plantsApi(25);
    const plants = await collect(client.plants.list({ limit: 10, offset: 5 }));

    expect(plants[0]).toEqual({ id: "p5" });
    expect(plants).toHaveLength(20);
  });

  it("stops requesting when the caller breaks out", async () => {
    const { client, requests } = plantsApi(1000);

    for await (const plant of client.plants.list({ limit: 50 })) {
      if (plant.id === "p60") break;
    }

    expect(requests).toHaveLength(2);
  });

  it("reuses the page an earlier await already fetched", async () => {
    const { client, requests } = plantsApi(60);
    const list = client.plants.list({ limit: 50 });

    await list;
    expect(await collect(list)).toHaveLength(60);
    expect(requests).toHaveLength(2);
  });
});

describe("iterating a list by cursor", () => {
  it("follows meta.next_cursor and stops when it is null", async () => {
    const { client, requests } = plantsApi(450, { cursors: true });

    const plants = await collect(client.plants.list({ limit: 200 }));

    expect(plants).toHaveLength(450);
    expect(requests.map((q) => q.get("cursor"))).toEqual([null, "c200", "c400"]);
    // A cursor replaces the offset; sending both is refused by the API.
    expect(requests.slice(1).every((q) => q.get("offset") === null)).toBe(true);
    expect(requests.every((q) => q.get("limit") === "200")).toBe(true);
  });

  it("does not ask again after a full last page", async () => {
    const { client, requests } = plantsApi(400, { cursors: true });

    expect(await collect(client.plants.list({ limit: 200 }))).toHaveLength(400);
    expect(requests).toHaveLength(2);
  });

  it("hands each page's cursor out, so a sync can resume in a later run", async () => {
    const { client, requests } = plantsApi(450, { cursors: true });

    const first = await client.plants.list({ limit: 200 }).pages().next();
    const saved = first.done ? null : first.value.nextCursor;
    expect(first.value).toMatchObject({ nextCursor: "c200", hasMore: true });

    const rest = await collect(client.plants.list({ limit: 200, cursor: saved ?? undefined }));
    expect(rest[0]).toEqual({ id: "p200" });
    expect(rest).toHaveLength(250);
    expect(requests[1].get("cursor")).toBe("c200");
  });

  it("marks the last page", async () => {
    const { client } = plantsApi(250, { cursors: true });
    const pages = await collect(client.plants.list({ limit: 200 }).pages());

    expect(pages.map((p) => [p.data.length, p.nextCursor, p.hasMore])).toEqual([
      [200, "c200", true],
      [50, null, false],
    ]);
  });

  it("surfaces INVALID_CURSOR so the caller can start again from the first page", async () => {
    const { client } = plantsApi(10, { cursors: true });

    const err = await client.plants.list({ cursor: "stale" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(XPlantError);
    expect((err as XPlantError).code).toBe("INVALID_CURSOR");
  });

  it("refuses a cursor on an endpoint that does not page by cursor yet", async () => {
    // The endpoint would ignore the cursor and answer from the top; returning
    // that as "the next page" would silently repeat records.
    const { client } = plantsApi(10);

    await expect(client.plants.list({ cursor: "c5" })).rejects.toThrow(/does not page by cursor/);
  });
});

describe("ListPromise", () => {
  it("offers pages() for batch processing", async () => {
    const { client } = plantsApi(120);
    const sizes = (await collect(client.plants.list().pages())).map((p) => p.data.length);
    expect(sizes).toEqual([50, 50, 20]);
  });

  it("is what every paged list method returns", () => {
    const { client } = plantsApi(0);
    for (const list of [
      client.plants.list(),
      client.explants.list(),
      client.stages.list({ explant_id: "e1" }),
      client.transfers.list({ plant_id: "p1" }),
      client.events.list({ entity: "plant" }),
      client.tasks.list(),
      client.taskDemand.list(),
      client.sops.list(),
      client.contaminations.list(),
      client.comments.list({ entity_type: "plant", entity_id: "p1" }),
      client.assets.list({ target: "plant", target_id: "p1" }),
      client.mediaRecipes.list(),
      client.equipment.list(),
      client.equipment.listEvents("eq1"),
      client.pricing.listCultureLines(),
      client.pricing.listEvents(),
      client.commerce.listOrderLines(),
      client.commerce.getSellThrough(),
    ]) {
      expect(list).toBeInstanceOf(ListPromise);
    }
  });
});
