import { afterEach, describe, it, expect, vi } from "vitest";
import { XPlantClient, XPlantError } from "./client.js";

describe("XPlantClient", () => {
  it("instantiates with an API key", () => {
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    expect(client).toBeInstanceOf(XPlantClient);
  });

  it("exposes resource accessors", () => {
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    expect(client.sensorReadings).toBeDefined();
    expect(client.devices).toBeDefined();
    expect(client.plants).toBeDefined();
    expect(client.tasks).toBeDefined();
    expect(client.labels).toBeDefined();
  });

  it("accepts a custom baseUrl", () => {
    const client = new XPlantClient({
      apiKey: "xpk_live_test",
      baseUrl: "https://custom.example.com",
    });
    expect(client).toBeInstanceOf(XPlantClient);
  });

  it("defaults to production when no baseUrl is given", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
      );
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    await client.plants.list();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.xplantpro.com/api/v1/plants",
      expect.anything(),
    );
  });
});

describe("XPlantClient#request", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unwraps the Result envelope's data on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: [{ id: "p1", name: "Monstera" }] }),
        { status: 200 },
      ),
    );
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    const plants = await client.plants.list();
    expect(plants).toEqual([{ id: "p1", name: "Monstera" }]);
  });

  it("throws XPlantError with the envelope's error and code on ok: false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          data: null,
          error: "Missing scope: read:plants",
          code: "FORBIDDEN",
        }),
        { status: 403 },
      ),
    );
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    await expect(client.plants.list()).rejects.toMatchObject({
      status: 403,
      body: "Missing scope: read:plants",
      code: "FORBIDDEN",
    });
  });

  it("falls back to the raw body when the response isn't the Result envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    await expect(client.plants.list()).rejects.toMatchObject({
      status: 500,
      body: "Internal Server Error",
    });
  });
});

describe("TasksResource#create / #update", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("create() POSTs to /api/v1/tasks and returns the unwrapped task", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { id: "t1", title: "Replate N2001", priority: "urgent" },
        }),
        { status: 201 },
      ),
    );
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    const task = await client.tasks.create({
      title: "Replate N2001",
      priority: "urgent",
      assigned_to: "teammate-uuid",
    });

    expect(task).toEqual({ id: "t1", title: "Replate N2001", priority: "urgent" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      title: "Replate N2001",
      priority: "urgent",
      assigned_to: "teammate-uuid",
    });
  });

  it("update() PATCHes /api/v1/tasks/{id} and returns the unwrapped task", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { id: "t1", priority: "high" } }),
        { status: 200 },
      ),
    );
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    const task = await client.tasks.update("t1", { priority: "high" });

    expect(task).toEqual({ id: "t1", priority: "high" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.xplantpro.com/api/v1/tasks/t1");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({ priority: "high" });
  });
});

describe("XPlantError", () => {
  it("stores status and body", () => {
    const err = new XPlantError(403, "Forbidden");
    expect(err.status).toBe(403);
    expect(err.body).toBe("Forbidden");
    expect(err).toBeInstanceOf(Error);
  });

  it("stores an optional code", () => {
    const err = new XPlantError(403, "Forbidden", "FORBIDDEN");
    expect(err.code).toBe("FORBIDDEN");
  });

  it("has a readable message", () => {
    const err = new XPlantError(401, "Unauthorized");
    expect(err.message).toContain("401");
  });
});
