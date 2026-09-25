import { afterEach, describe, expect, it, vi } from "vitest";
import { API_KEYS_URL, DEFAULT_BASE_URL, XPlantClient, XPlantError } from "./client.js";

interface Reply {
  status?: number;
  body: string;
  headers?: Record<string, string>;
}

/** Installs a fetch stub and records the calls it received. */
function stubFetch(responder: (url: string, init: RequestInit, attempt: number) => Reply) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const { status = 200, body, headers = {} } = responder(url, init, calls.length - 1);
    return Promise.resolve(new Response(body, { status, headers }));
  });
  return calls;
}

const ok = (data: unknown): Reply => ({ body: JSON.stringify({ ok: true, data }) });

const fail = (status: number, code: string, headers: Record<string, string> = {}): Reply => ({
  status,
  headers,
  body: JSON.stringify({ ok: false, data: null, error: `failed with ${code}`, code }),
});

const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("XPlantClient", () => {
  it("instantiates with an API key", () => {
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    expect(client).toBeInstanceOf(XPlantClient);
  });

  it("exposes resource accessors", () => {
    const client = new XPlantClient({ apiKey: "xpk_live_test" });
    for (const name of [
      "me",
      "workspaces",
      "plants",
      "explants",
      "stages",
      "transfers",
      "events",
      "tasks",
      "taskDemand",
      "sops",
      "sopRuns",
      "labels",
      "devices",
      "sensorReadings",
      "equipment",
    ] as const) {
      expect(client[name]).toBeDefined();
    }
  });

  it("throws without a credential, and says where to get one", () => {
    expect(() => new XPlantClient({ apiKey: "" })).toThrow(/apiKey is required/);
    expect(() => new XPlantClient({})).toThrow(API_KEYS_URL);
  });
});

describe("credentials", () => {
  it("sends a device token as the bearer credential", async () => {
    const calls = stubFetch(() => ok({ received_at: "2026-09-25T00:00:00.000Z" }));
    await new XPlantClient({ deviceToken: "xpd_live_abc" }).devices.heartbeat("d1");

    expect(headersOf(calls[0].init).Authorization).toBe("Bearer xpd_live_abc");
  });

  it("refuses a workspace key passed as a device token", () => {
    // A workspace key on a device can read and write the whole lab. Catching it
    // at construction is cheaper than finding it in a shared grow room.
    expect(() => new XPlantClient({ deviceToken: "xpk_live_abc" })).toThrow(
      /Never put a workspace API key on a device/,
    );
  });

  it("refuses both credentials at once", () => {
    expect(
      () => new XPlantClient({ apiKey: "xpk_live_abc", deviceToken: "xpd_live_abc" }),
    ).toThrow(/not both/);
  });

  it("still accepts a device token passed as apiKey", async () => {
    const calls = stubFetch(() => ok({ received_at: "2026-09-25T00:00:00.000Z" }));
    await new XPlantClient({ apiKey: "xpd_live_abc" }).devices.heartbeat("d1");

    expect(headersOf(calls[0].init).Authorization).toBe("Bearer xpd_live_abc");
  });
});

describe("base URL", () => {
  it("defaults to the API host, not the marketing site", async () => {
    // www.xplantpro.com is the marketing site and answers 401 for every
    // /api/* path, even with a valid key. The API lives on the app host.
    expect(DEFAULT_BASE_URL).toBe("https://app.xplantpro.com");
    expect(API_KEYS_URL).toBe("https://app.xplantpro.com/settings/integrations/api-keys");

    const calls = stubFetch(() => ok([]));
    await new XPlantClient({ apiKey: "xpk_live_test" }).plants.list();

    expect(calls[0].url).toBe("https://app.xplantpro.com/api/v1/plants");
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

    expect(headersOf(calls[0].init).Authorization).toBe("Bearer xpk_live_test");
  });

  it("uses a fetch passed in the config instead of the global one", async () => {
    const custom = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }))));
    await new XPlantClient({ apiKey: "xpk_live_test", fetch: custom }).plants.list();

    expect(custom).toHaveBeenCalledOnce();
  });

  it("merges caller headers given as a Headers instance", async () => {
    const calls = stubFetch(() => ok([]));
    await new XPlantClient({ apiKey: "xpk_live_test" }).request("/api/v1/plants", {
      headers: new Headers({ "X-Trace": "abc" }),
    });

    expect(headersOf(calls[0].init)["x-trace"]).toBe("abc");
    expect(headersOf(calls[0].init).Authorization).toBe("Bearer xpk_live_test");
  });
});

describe("response envelope", () => {
  const client = () => new XPlantClient({ apiKey: "xpk_live_test" });

  it("unwraps a wrapped list into the records themselves", async () => {
    stubFetch(() =>
      ok([
        {
          id: "p1",
          name: "Alocasia zebrina",
          species: "Alocasia zebrina",
          status: "active",
          workspace_id: null,
          created_at: "2026-08-01T00:00:00.000Z",
          external_id: null,
        },
      ]),
    );

    const plants = await client().plants.list();

    expect(Array.isArray(plants)).toBe(true);
    expect(plants[0].name).toBe("Alocasia zebrina");
    // The envelope must not leak through as the value.
    expect(plants).not.toHaveProperty("data");
  });

  it("unwraps a wrapped single record", async () => {
    stubFetch(() => ok({ id: "p1", name: "Phalaenopsis amabilis" }));

    const plant = await client().plants.get("p1");

    expect(plant.id).toBe("p1");
    expect(plant.name).toBe("Phalaenopsis amabilis");
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
    expect(apiError.retryAfter).toBeNull();
  });

  it("names the code for a validation failure", async () => {
    stubFetch(() => fail(422, "VALIDATION_ERROR"));

    const err = await client()
      .tasks.create({ title: "" })
      .catch((caught: unknown) => caught);

    expect((err as XPlantError).code).toBe("VALIDATION_ERROR");
    expect((err as XPlantError).status).toBe(422);
  });

  it("handles an envelope that omits data and carries a non-standard code", async () => {
    // Older device and sensor routes answered like this. Callers branch on
    // status for the class of failure, so the SDK must not depend on the code.
    stubFetch(() => ({
      status: 403,
      body: JSON.stringify({ ok: false, error: "Missing scope: write:devices", code: "UNAUTHORIZED" }),
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

  it("puts Retry-After on a rate-limit error", async () => {
    stubFetch(() => fail(429, "RATE_LIMIT_EXCEEDED", { "Retry-After": "17" }));

    const err = await client()
      .plants.list()
      .catch((caught: unknown) => caught);

    expect((err as XPlantError).code).toBe("RATE_LIMIT_EXCEEDED");
    expect((err as XPlantError).retryAfter).toBe(17);
  });

  it("does not retry unless retry is enabled", async () => {
    const calls = stubFetch(() => fail(429, "RATE_LIMIT_EXCEEDED", { "Retry-After": "1" }));

    await expect(client().plants.list()).rejects.toBeInstanceOf(XPlantError);
    expect(calls).toHaveLength(1);
  });
});

describe("retry", () => {
  const retrying = (retry: object | true = { baseDelayMs: 0 }) =>
    new XPlantClient({ apiKey: "xpk_live_test", retry });

  it("waits out Retry-After on a 429, then succeeds", async () => {
    vi.useFakeTimers();
    const calls = stubFetch((_url, _init, attempt) =>
      attempt === 0 ? fail(429, "RATE_LIMIT_EXCEEDED", { "Retry-After": "2" }) : ok([]),
    );

    const pending = retrying(true).plants.list();
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it("retries a 429 on a write the server does not replay, since it never ran", async () => {
    const calls = stubFetch((_url, _init, attempt) =>
      attempt === 0 ? fail(429, "RATE_LIMIT_EXCEEDED", { "Retry-After": "0" }) : ok({ id: "tr1" }),
    );

    await retrying().transfers.create({ explant_id: "e1" });
    expect(calls).toHaveLength(2);
  });

  it("throws rather than wait longer than maxDelayMs", async () => {
    const calls = stubFetch(() => fail(429, "RATE_LIMIT_EXCEEDED", { "Retry-After": "120" }));

    const err = await retrying({ maxDelayMs: 60_000 })
      .plants.list()
      .catch((caught: unknown) => caught);

    expect((err as XPlantError).retryAfter).toBe(120);
    expect(calls).toHaveLength(1);
  });

  it("gives up after maxRetries and throws the last error", async () => {
    const calls = stubFetch(() => fail(503, "SERVICE_UNAVAILABLE"));

    const err = await retrying({ baseDelayMs: 0, maxRetries: 2 })
      .plants.list()
      .catch((caught: unknown) => caught);

    expect((err as XPlantError).status).toBe(503);
    expect(calls).toHaveLength(3);
  });

  it("does not resend a write the server does not replay after a 503", async () => {
    // Nothing proves the first attempt did not land.
    const calls = stubFetch(() => fail(503, "DEVICE_LIMIT_UNAVAILABLE"));

    await expect(retrying().devices.register({ name: "Shelf 3" })).rejects.toBeInstanceOf(
      XPlantError,
    );
    expect(calls).toHaveLength(1);
  });

  it("resends a replayable write after a 503, under the same key", async () => {
    const calls = stubFetch((_url, _init, attempt) =>
      attempt === 0 ? fail(503, "SERVICE_UNAVAILABLE") : ok({ id: "t1" }),
    );

    await retrying().tasks.create({ title: "Subculture" });

    expect(calls).toHaveLength(2);
    expect(headersOf(calls[1].init)["Idempotency-Key"]).toBe(
      headersOf(calls[0].init)["Idempotency-Key"],
    );
  });

  it("retries 409 IDEMPOTENCY_IN_FLIGHT until the first attempt's result is ready", async () => {
    const calls = stubFetch((_url, _init, attempt) =>
      attempt === 0 ? fail(409, "IDEMPOTENCY_IN_FLIGHT", { "Retry-After": "0" }) : ok({ id: "t1" }),
    );

    await retrying().tasks.create({ title: "Subculture" });
    expect(calls).toHaveLength(2);
  });

  it("does not retry a 409 that is a real conflict", async () => {
    const calls = stubFetch(() => fail(409, "SOP_RUN_CLOSED"));

    await expect(
      retrying().sopRuns.recordStepEvent("r1", "s1", { event_type: "confirmed" }),
    ).rejects.toMatchObject({ code: "SOP_RUN_CLOSED" });
    expect(calls).toHaveLength(1);
  });

  it("stops waiting when the signal aborts", async () => {
    vi.useFakeTimers();
    stubFetch(() => fail(429, "RATE_LIMIT_EXCEEDED", { "Retry-After": "30" }));
    const controller = new AbortController();

    const pending = retrying(true).plants.list({}, { signal: controller.signal });
    const outcome = pending.catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(10);
    controller.abort(new Error("stopped"));

    await expect(outcome).resolves.toMatchObject({ message: "stopped" });
  });
});

describe("Idempotency-Key", () => {
  it("sends a caller's key on a write", async () => {
    const calls = stubFetch(() => ok({ id: "t1" }));
    await new XPlantClient({ apiKey: "xpk_live_test" }).tasks.create(
      { title: "Subculture" },
      { idempotencyKey: "subculture-b-2026-114-pass-2" },
    );

    expect(headersOf(calls[0].init)["Idempotency-Key"]).toBe("subculture-b-2026-114-pass-2");
  });

  it("sends none on a write when retry is off and no key is given", async () => {
    const calls = stubFetch(() => ok({ id: "t1" }));
    await new XPlantClient({ apiKey: "xpk_live_test" }).tasks.create({ title: "Subculture" });

    expect(headersOf(calls[0].init)).not.toHaveProperty("Idempotency-Key");
  });

  it("generates a fresh, valid key per write when retry is on", async () => {
    const calls = stubFetch(() => ok({ id: "t1" }));
    const client = new XPlantClient({ apiKey: "xpk_live_test", retry: true });

    await client.tasks.create({ title: "One" });
    await client.tasks.create({ title: "Two" });

    const [first, second] = calls.map((c) => headersOf(c.init)["Idempotency-Key"]);
    expect(first).toMatch(/^[A-Za-z0-9._:~-]{8,255}$/);
    expect(second).toMatch(/^[A-Za-z0-9._:~-]{8,255}$/);
    expect(first).not.toBe(second);
  });

  it("never sends one on a read", async () => {
    const calls = stubFetch(() => ok([]));
    await new XPlantClient({ apiKey: "xpk_live_test", retry: true }).plants.list();

    expect(headersOf(calls[0].init)).not.toHaveProperty("Idempotency-Key");
  });
});

describe("XPlantError", () => {
  it("stores status and body", () => {
    const err = new XPlantError(403, "Forbidden");
    expect(err.status).toBe(403);
    expect(err.body).toBe("Forbidden");
    expect(err.code).toBeNull();
    expect(err.retryAfter).toBeNull();
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
