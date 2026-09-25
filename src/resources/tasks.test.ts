import { afterEach, describe, expect, it, vi } from "vitest";
import { XPlantClient } from "../client.js";
import type { TaskSummary } from "../types.js";

const SKIP_MESSAGE =
  "Left this task where someone put it by hand. Send release: true to hand it back to automatic ordering.";

const task = (overrides: Partial<TaskSummary> = {}): TaskSummary => ({
  id: "t1",
  title: "Replate N2001 — second pass",
  status: "todo",
  due_date: "2026-08-10T09:00:00.000Z",
  assigned_to: null,
  priority: "medium",
  priority_rank: 3000,
  priority_source: "default",
  category: "transfer",
  created_at: "2026-08-06T00:00:00.000Z",
  ...overrides,
});

function stubFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });
  return calls;
}

const client = () => new XPlantClient({ apiKey: "xpk_live_test" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tasks.list", () => {
  it("returns the records and passes filters through", async () => {
    const calls = stubFetch({ ok: true, data: [task()] });

    const tasks = await client().tasks.list({ status: "todo", limit: 25, offset: 50 });

    expect(tasks[0].title).toBe("Replate N2001 — second pass");
    expect(calls[0].url).toContain("/api/v1/tasks?");
    expect(calls[0].url).toContain("limit=25");
    expect(calls[0].url).toContain("offset=50");
    expect(calls[0].url).toContain("status=todo");
  });

  it("omits the query string when no filters are given", async () => {
    const calls = stubFetch({ ok: true, data: [] });

    await client().tasks.list();

    expect(calls[0].url).toBe("https://app.xplantpro.com/api/v1/tasks");
  });
});

describe("tasks.create", () => {
  it("POSTs the payload and returns the created task", async () => {
    const created = task({ priority: "high", priority_source: "auto", assigned_to: "u1" });
    const calls = stubFetch({ ok: true, data: created }, 201);

    const result = await client().tasks.create({
      title: "Replate N2001 — second pass",
      priority: "high",
      assigned_to: "u1",
      category: "transfer",
    });

    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].url).toBe("https://app.xplantpro.com/api/v1/tasks");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      title: "Replate N2001 — second pass",
      priority: "high",
      assigned_to: "u1",
      category: "transfer",
    });
    expect(result.id).toBe("t1");
    expect(result.priority).toBe("high");
    expect(result.assigned_to).toBe("u1");
    expect(result.priority_source).toBe("auto");
  });
});

describe("tasks.update", () => {
  it("PATCHes the payload and returns the stored task", async () => {
    const calls = stubFetch({
      ok: true,
      data: task({ priority: "urgent", priority_rank: 1500, priority_source: "auto" }),
      meta: {
        priority_write: {
          applied: true,
          priority_source: "auto",
          message: "Ordering updated.",
        },
      },
    });

    const result = await client().tasks.update("t1", { priority: "urgent", priority_rank: 1500 });

    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].url).toBe("https://app.xplantpro.com/api/v1/tasks/t1");
    expect(result.task.priority_rank).toBe(1500);
    expect(result.skipped).toBe(false);
    expect(result.priority_write?.applied).toBe(true);
  });

  it("reports a task skipped by the manual-override rule instead of swallowing it", async () => {
    // The server answers 200: the skip is a success, so nothing throws and a
    // caller that only checks for errors would believe the write landed.
    stubFetch({
      ok: true,
      data: task({ priority: "urgent", priority_rank: 1500, priority_source: "manual" }),
      meta: {
        priority_write: {
          applied: false,
          reason: "manual_override",
          priority_source: "manual",
          message: SKIP_MESSAGE,
        },
      },
    });

    const result = await client().tasks.update("t1", { priority_rank: 9000 });

    expect(result.skipped).toBe(true);
    expect(result.priority_write).toEqual({
      applied: false,
      reason: "manual_override",
      priority_source: "manual",
      message: SKIP_MESSAGE,
    });
    // `data` is what the server stored — the order that won, not what we sent.
    expect(result.task.priority_rank).toBe(1500);
    expect(result.task.priority_source).toBe("manual");
  });

  it("sends release: true to take a hand-ordered task back under automatic control", async () => {
    const calls = stubFetch({
      ok: true,
      data: task({ priority_rank: 9000, priority_source: "auto" }),
      meta: {
        priority_write: { applied: true, priority_source: "auto", message: "Ordering updated." },
      },
    });

    const result = await client().tasks.update("t1", { priority_rank: 9000, release: true });

    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      priority_rank: 9000,
      release: true,
    });
    expect(result.skipped).toBe(false);
    expect(result.task.priority_source).toBe("auto");
  });

  it("reports no priority write when the patch touched no ordering fields", async () => {
    stubFetch({ ok: true, data: task({ title: "Renamed" }) });

    const result = await client().tasks.update("t1", { title: "Renamed" });

    expect(result.priority_write).toBeNull();
    expect(result.skipped).toBe(false);
    expect(result.task.title).toBe("Renamed");
  });

  it("treats an unrecognised report as not applied rather than dropping it", async () => {
    stubFetch({
      ok: true,
      data: task(),
      meta: { priority_write: { reason: "manual_override" } },
    });

    const result = await client().tasks.update("t1", { priority: "low" });

    expect(result.skipped).toBe(true);
    expect(result.priority_write?.applied).toBe(false);
  });
});
