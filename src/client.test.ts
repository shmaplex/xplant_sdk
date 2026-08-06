import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BASE_URL, XPlantClient, XPlantError } from "./client.js";

/** Installs a fetch stub and records the calls it received. */
function stubFetch(
  responder: (url: string, init: RequestInit) => { status?: number; body: string },
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const { status = 200, body } = responder(url, init);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body),
    });
  });
  return calls;
}

const ok = (data: unknown) => ({ body: JSON.stringify({ ok: true, data }) });

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("throws without an API key", () => {
    expect(() => new XPlantClient({ apiKey: "" })).toThrow(/apiKey is required/);
  });
});

describe("base URL", () => {
  it("defaults to the production host", async () => {
    expect(DEFAULT_BASE_URL).toBe("https://www.xplantpro.com");

    const calls = stubFetch(() => ok([]));
    await new XPlantClient({ apiKey: "xpk_live_test" }).plants.list();

    expect(calls[0].url).toBe("https://www.xplantpro.com/api/v1/plants");
  });

  it("accepts a custom baseUrl and strips a trailing slash", async () => {
    const calls = stubFetch(() => ok([]));
    await new XPlantClient({
      apiKey: "xpk_live_test",
      baseUrl: "https://custom.example.com/",
    }).plants.list();

    expect(calls[0].url).toBe("https://custom.example.com/api/v1/plants");
  });

  it("sends the API key as a bearer token", async () => {
    const calls = stubFetch(() => ok([]));
    await new XPlantClient({ apiKey: "xpk_live_test" }).plants.list();

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer xpk_live_test");
  });
});

describe("response envelope", () => {
  const client = () => new XPlantClient({ apiKey: "xpk_live_test" });

  it("unwraps a wrapped list into the records themselves", async () => {
    stubFetch(() =>
      ok([
        {
          id: "p1",
          name: "Nepenthes ventricosa",
          species: "Nepenthes ventricosa",
          status: "active",
          workspace_id: null,
          created_at: "2026-08-01T00:00:00.000Z",
        },
      ]),
    );

    const plants = await client().plants.list();

    expect(Array.isArray(plants)).toBe(true);
    expect(plants[0].name).toBe("Nepenthes ventricosa");
    // The envelope must not leak through as the value.
    expect(plants).not.toHaveProperty("data");
  });

  it("unwraps a wrapped single record", async () => {
    stubFetch(() => ok({ id: "p1", name: "Sarracenia flava" }));

    const plant = await client().plants.get("p1");

    expect(plant.id).toBe("p1");
    expect(plant.name).toBe("Sarracenia flava");
  });

  it("returns the whole envelope from requestEnvelope()", async () => {
    stubFetch(() => ok([{ id: "p1" }]));

    const envelope = await client().requestEnvelope<Array<{ id: string }>>("/api/v1/plants");

    expect(envelope.ok).toBe(true);
    expect(envelope.data[0].id).toBe("p1");
  });
});

describe("error handling", () => {
  const client = () => new XPlantClient({ apiKey: "xpk_live_test" });

  it("raises an error, not data, for a failure envelope", async () => {
    stubFetch(() => ({
      status: 403,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: "Missing scope: read:plants",
        code: "FORBIDDEN",
      }),
    }));

    const err = await client()
      .plants.list()
      .catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(XPlantError);
    const apiError = err as XPlantError;
    expect(apiError.status).toBe(403);
    expect(apiError.code).toBe("FORBIDDEN");
    // The missing scope must be named so the caller knows what to add.
    expect(apiError.message).toContain("read:plants");
  });

  it("names the code for a validation failure", async () => {
    stubFetch(() => ({
      status: 422,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: "title: title is required",
        code: "VALIDATION_ERROR",
      }),
    }));

    const err = await client()
      .tasks.create({ title: "" })
      .catch((caught: unknown) => caught);

    expect((err as XPlantError).code).toBe("VALIDATION_ERROR");
    expect((err as XPlantError).status).toBe(422);
  });

  it("handles the device routes' envelope, which omits data and reuses UNAUTHORIZED for 403", async () => {
    stubFetch(() => ({
      status: 403,
      body: JSON.stringify({
        ok: false,
        error: "Missing scope: write:devices",
        code: "UNAUTHORIZED",
      }),
    }));

    const err = await client()
      .devices.heartbeat("d1")
      .catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(XPlantError);
    expect((err as XPlantError).status).toBe(403);
    expect((err as XPlantError).code).toBe("UNAUTHORIZED");
  });

  it("still raises when a 2xx body carries a failure envelope", async () => {
    stubFetch(() => ({
      status: 200,
      body: JSON.stringify({ ok: false, data: null, error: "Task not found", code: "NOT_FOUND" }),
    }));

    const err = await client()
      .tasks.get("missing")
      .catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(XPlantError);
    expect((err as XPlantError).code).toBe("NOT_FOUND");
  });

  it("raises a readable error when a gateway answers with non-JSON", async () => {
    stubFetch(() => ({ status: 502, body: "<html>Bad Gateway</html>" }));

    const err = await client()
      .plants.list()
      .catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(XPlantError);
    expect((err as XPlantError).status).toBe(502);
    expect((err as XPlantError).code).toBeNull();
    expect((err as XPlantError).body).toContain("Bad Gateway");
  });
});

describe("XPlantError", () => {
  it("stores status and body", () => {
    const err = new XPlantError(403, "Forbidden");
    expect(err.status).toBe(403);
    expect(err.body).toBe("Forbidden");
    expect(err.code).toBeNull();
    expect(err).toBeInstanceOf(Error);
  });

  it("has a readable message", () => {
    const err = new XPlantError(401, "Unauthorized");
    expect(err.message).toContain("401");
  });

  it("includes the code when one is known", () => {
    const err = new XPlantError(404, "{}", "NOT_FOUND", "Task not found");
    expect(err.message).toContain("NOT_FOUND");
    expect(err.message).toContain("Task not found");
  });
});
