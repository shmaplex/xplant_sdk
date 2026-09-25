import { afterEach, describe, expect, it, vi } from "vitest";
import { XPlantClient, XPlantError } from "./index.js";
import { fakeXPlant, V1_ENDPOINTS, type FakeXPlant } from "./testing/fake-xplant.js";

/**
 * Every public SDK method, called once against a server that only answers
 * paths the real API actually exposes.
 *
 * This is the test the 0.1.x suite was missing. Five methods called routes that
 * had never been implemented and shipped anyway, because the old fetch stub
 * returned 200 for any URL — so nothing in CI could tell a working call from a
 * 404. Here a path absent from `v1-surface.json` returns 404 and the SDK throws,
 * which fails the test.
 *
 * Add a method to the SDK and it must be added here too; a resource method with
 * no entry in this table is a method nobody has proven reaches the API.
 */

const BASE_URL = "https://api.test";
const DEVICE_TOKEN = "xpd_live_contract";
const DEVICE_ID = "d1";

const client = (options: { fetch?: typeof fetch; retry?: boolean | object } = {}) =>
  new XPlantClient({ apiKey: "xpk_live_contract", baseUrl: BASE_URL, ...options });

afterEach(() => {
  vi.unstubAllGlobals();
});

interface Invocation {
  name: string;
  expect: string;
  call: (c: XPlantClient, options?: { idempotencyKey?: string }) => Promise<unknown>;
  /** Payload the route returns, when the method needs a specific one. */
  response?: unknown;
}

/** One invocation per public method, with the route it is expected to reach. */
const INVOCATIONS: Invocation[] = [
  { name: "me.get", expect: "GET /api/v1/me", call: (c) => c.me.get() },
  { name: "workspaces.list", expect: "GET /api/v1/workspaces", call: (c) => c.workspaces.list() },

  { name: "plants.list", expect: "GET /api/v1/plants", call: (c) => c.plants.list({ limit: 10 }) },
  { name: "plants.get", expect: "GET /api/v1/plants/{id}", call: (c) => c.plants.get("p1") },
  {
    name: "plants.findByExternalId",
    expect: "GET /api/v1/plants",
    call: (c) => c.plants.findByExternalId("LINE-0412"),
  },
  {
    name: "plants.create",
    expect: "POST /api/v1/plants",
    call: (c, o) => c.plants.create({ species: "Alocasia zebrina", external_id: "LINE-0412" }, o),
  },
  {
    name: "plants.update",
    expect: "PATCH /api/v1/plants/{id}",
    call: (c, o) => c.plants.update("p1", { status: "in_culture" }, o),
  },
  {
    name: "explants.create",
    expect: "POST /api/v1/explants",
    call: (c, o) => c.explants.create({ label: "B-2026-114", plant_id: "p1" }, o),
  },
  {
    name: "explants.update",
    expect: "PATCH /api/v1/explants/{id}",
    call: (c, o) => c.explants.update("e1", { status: "needs_subculture" }, o),
  },
  {
    name: "explants.list",
    expect: "GET /api/v1/explants",
    call: (c) => c.explants.list({ limit: 10 }),
  },
  { name: "explants.get", expect: "GET /api/v1/explants/{id}", call: (c) => c.explants.get("e1") },
  {
    name: "explants.findByExternalId",
    expect: "GET /api/v1/explants",
    call: (c) => c.explants.findByExternalId("LINE-0412"),
  },

  {
    name: "stages.list",
    expect: "GET /api/v1/stages",
    call: (c) => c.stages.list({ explant_id: "e1" }),
  },
  {
    name: "stages.advance",
    expect: "POST /api/v1/stages",
    call: (c, o) => c.stages.advance({ explant_id: "e1", stage: "rooting" }, o),
  },
  {
    name: "transfers.list",
    expect: "GET /api/v1/transfers",
    call: (c) => c.transfers.list({ plant_id: "p1" }),
  },
  {
    name: "transfers.create",
    expect: "POST /api/v1/transfers",
    call: (c, o) => c.transfers.create({ explant_id: "e1", to_location: "Shelf 3" }, o),
  },
  {
    name: "events.list",
    expect: "GET /api/v1/events",
    call: (c) => c.events.list({ entity: "plant" }),
  },

  {
    name: "tasks.list",
    expect: "GET /api/v1/tasks",
    call: (c) => c.tasks.list({ status: "todo" }),
  },
  { name: "tasks.get", expect: "GET /api/v1/tasks/{id}", call: (c) => c.tasks.get("t1") },
  {
    name: "tasks.create",
    expect: "POST /api/v1/tasks",
    call: (c, o) => c.tasks.create({ title: "Subculture B-2026-114" }, o),
  },
  {
    name: "tasks.update",
    expect: "PATCH /api/v1/tasks/{id}",
    call: (c, o) => c.tasks.update("t1", { priority: "high" }, o),
  },
  {
    name: "taskDemand.list",
    expect: "GET /api/v1/tasks/demand",
    call: (c) => c.taskDemand.list({ genus: "Alocasia" }),
  },
  {
    name: "taskDemand.record",
    expect: "POST /api/v1/tasks/demand",
    call: (c, o) =>
      c.taskDemand.record({ genus: "Alocasia", demand_score: 10, source: "test" }, o),
  },

  { name: "sops.list", expect: "GET /api/v1/sops", call: (c) => c.sops.list() },
  { name: "sops.get", expect: "GET /api/v1/sops/{id}", call: (c) => c.sops.get("s1") },
  {
    name: "sopRuns.start",
    expect: "POST /api/v1/sop-runs",
    call: (c, o) => c.sopRuns.start({ sop_id: "s1", batch_code: "B-2026-114" }, o),
  },
  { name: "sopRuns.get", expect: "GET /api/v1/sop-runs/{id}", call: (c) => c.sopRuns.get("r1") },
  {
    name: "sopRuns.recordStepEvent",
    expect: "POST /api/v1/sop-runs/{id}/steps/{stepId}/events",
    call: (c, o) => c.sopRuns.recordStepEvent("r1", "step-1", { event_type: "confirmed" }, o),
  },
  {
    name: "sopRuns.recordMeasurement",
    expect: "POST /api/v1/sop-runs/{id}/steps/{stepId}/measurements",
    call: (c, o) =>
      c.sopRuns.recordMeasurement("r1", "step-2", { metric: "ph", value: 5.7, unit: "pH" }, o),
  },

  {
    name: "labels.resolve",
    expect: "GET /api/v1/labels/resolve",
    call: (c) => c.labels.resolve("XP-0001"),
  },
  {
    name: "labels.recordScan",
    expect: "POST /api/v1/label-scans",
    call: (c, o) => c.labels.recordScan({ barcode: "XP-0001", context: "Shelf 3" }, o),
  },

  { name: "devices.list", expect: "GET /api/v1/devices", call: (c) => c.devices.list() },
  {
    // There is no `GET /api/v1/devices/{id}` on the server, so this lists and
    // filters client-side. The response therefore has to contain the device,
    // or the SDK raises its own 404 before the route is ever in question.
    name: "devices.get",
    expect: "GET /api/v1/devices",
    call: (c) => c.devices.get(DEVICE_ID),
    response: [{ id: DEVICE_ID, name: "Shelf 3" }],
  },
  {
    name: "devices.register",
    expect: "POST /api/v1/devices",
    call: (c, o) => c.devices.register({ name: "Shelf 3" }, o),
  },
  {
    name: "devices.heartbeat",
    expect: "POST /api/v1/devices/{deviceId}/heartbeat",
    call: (c, o) => c.devices.heartbeat(DEVICE_ID, undefined, o),
  },
  {
    name: "devices.recordEvent",
    expect: "POST /api/v1/device-events",
    call: (c, o) => c.devices.recordEvent({ device_id: DEVICE_ID, event_type: "alert" }, o),
  },
  {
    name: "devices.createToken",
    expect: "POST /api/v1/devices/{deviceId}/tokens",
    call: (c, o) => c.devices.createToken(DEVICE_ID, { name: "shelf-3" }, o),
  },
  {
    name: "devices.revokeToken",
    expect: "DELETE /api/v1/devices/{deviceId}/tokens/{tokenId}",
    call: (c, o) => c.devices.revokeToken(DEVICE_ID, "tok1", o),
  },
  {
    name: "devices.listTokens",
    expect: "GET /api/v1/devices/{deviceId}/tokens",
    call: (c) => c.devices.listTokens(DEVICE_ID),
  },

  {
    name: "sensorReadings.list",
    expect: "GET /api/v1/sensor-readings",
    call: (c) => c.sensorReadings.list({ device_id: DEVICE_ID }),
  },
  {
    name: "sensorReadings.create",
    expect: "POST /api/v1/sensor-readings",
    call: (c, o) =>
      c.sensorReadings.create(
        { device_id: DEVICE_ID, type: "temperature", value: 22.5, unit: "C" },
        o,
      ),
  },
  {
    name: "sensorReadings.createBatch",
    expect: "POST /api/v1/sensor-readings",
    call: (c, o) =>
      c.sensorReadings.createBatch(
        [
          {
            device_id: DEVICE_ID,
            type: "humidity",
            value: 71,
            unit: "%",
            recorded_at: "2026-09-25T00:00:00Z",
            external_id: "d1-humidity-20260925T0000",
          },
        ],
        o,
      ),
  },

  {
    name: "contaminations.list",
    expect: "GET /api/v1/contaminations",
    call: (c) => c.contaminations.list({ status: "active" }),
  },
  {
    name: "contaminations.get",
    expect: "GET /api/v1/contaminations/{id}",
    call: (c) => c.contaminations.get("x1"),
  },
  {
    name: "contaminations.create",
    expect: "POST /api/v1/contaminations",
    call: (c, o) =>
      c.contaminations.create({ explant_id: "e1", type: "fungal", issue: "White fuzz at the media line" }, o),
  },
  {
    name: "comments.list",
    expect: "GET /api/v1/comments",
    call: (c) => c.comments.list({ entity_type: "explant", entity_id: "e1" }),
  },
  {
    name: "comments.create",
    expect: "POST /api/v1/comments",
    call: (c, o) =>
      c.comments.create({ entity_type: "explant", entity_id: "e1", body: "Moved to shelf 3" }, o),
  },
  {
    name: "assets.list",
    expect: "GET /api/v1/assets",
    call: (c) => c.assets.list({ target: "explant", target_id: "e1" }),
  },
  { name: "assets.get", expect: "GET /api/v1/assets/{id}", call: (c) => c.assets.get("a1") },
  {
    name: "assets.create",
    expect: "POST /api/v1/assets",
    call: (c, o) =>
      c.assets.create(
        { target: "explant", target_id: "e1", image_url: "https://example.com/jar-12.jpg" },
        o,
      ),
  },
  { name: "mediaRecipes.list", expect: "GET /api/v1/media-recipes", call: (c) => c.mediaRecipes.list() },
  {
    name: "mediaRecipes.get",
    expect: "GET /api/v1/media-recipes/{id}",
    call: (c) => c.mediaRecipes.get("m1"),
  },
  {
    name: "mediaRecipes.create",
    expect: "POST /api/v1/media-recipes",
    call: (c, o) =>
      c.mediaRecipes.create(
        { title: "MS + 2 mg/L BAP", components: [{ name: "MS basal salts", qty: "4.4", unit: "g/L" }] },
        o,
      ),
  },
  {
    name: "mediaRecipes.update",
    expect: "PATCH /api/v1/media-recipes/{id}",
    call: (c, o) => c.mediaRecipes.update("m1", { status: "archived" }, o),
  },
  { name: "equipment.list", expect: "GET /api/v1/equipment", call: (c) => c.equipment.list() },
  { name: "equipment.get", expect: "GET /api/v1/equipment/{id}", call: (c) => c.equipment.get("eq1") },
  {
    name: "equipment.listEvents",
    expect: "GET /api/v1/equipment/{id}/events",
    call: (c) => c.equipment.listEvents("eq1", { kind: "calibration" }),
  },
  {
    name: "pricing.listCultureLines",
    expect: "GET /api/v1/pricing/culture-lines",
    call: (c) => c.pricing.listCultureLines(),
  },
  {
    name: "pricing.listEvents",
    expect: "GET /api/v1/pricing/events",
    call: (c) => c.pricing.listEvents({ plant_id: "p1" }),
  },
  {
    name: "commerce.listOrderLines",
    expect: "GET /api/v1/commerce/order-lines",
    call: (c) => c.commerce.listOrderLines({ from: "2026-09-01T00:00:00Z" }),
  },
  {
    name: "commerce.getSellThrough",
    expect: "GET /api/v1/commerce/sell-through",
    call: (c) => c.commerce.getSellThrough({ from: "2026-07-01T00:00:00Z" }),
  },
  {
    // Not an endpoint of its own: a device-side queue that posts through
    // createBatch(). Closing it sends what was added.
    name: "sensorReadings.buffer",
    expect: "POST /api/v1/sensor-readings",
    call: async (c) => {
      const buffer = c.sensorReadings.buffer({ flushIntervalMs: 0, onError: () => {} });
      buffer.add({ device_id: DEVICE_ID, type: "co2", value: 800, unit: "ppm" });
      await buffer.close();
    },
  },

  {
    name: "equipment.recordEvent",
    expect: "POST /api/v1/equipment/{id}/events",
    call: (c, o) =>
      c.equipment.recordEvent("eq1", { kind: "calibration", outcome: "pass_after_adjustment" }, o),
  },
];

const ENDPOINTS = new Map(V1_ENDPOINTS.map((e) => [`${e.method} ${e.path}`, e]));
const isWrite = (invocation: Invocation) => !invocation.expect.startsWith("GET ");

function serverFor(invocation: Invocation, options: Parameters<typeof fakeXPlant>[0] = {}) {
  return fakeXPlant({
    ...options,
    responses: { [invocation.expect]: invocation.response ?? [] },
  });
}

/** A fetch that fails the first `failures` attempts at the network, then reaches `server`. */
function flaky(server: FakeXPlant, failures = 1) {
  const attempts: Array<Record<string, string>> = [];
  let remaining = failures;
  const fetchImpl = ((input: string, init: RequestInit = {}) => {
    attempts.push({ ...(init.headers as Record<string, string>) });
    if (remaining > 0) {
      remaining -= 1;
      return Promise.reject(new TypeError("fetch failed"));
    }
    return server.fetch(input, init);
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, attempts };
}

describe("every SDK method reaches a route that exists", () => {
  for (const invocation of INVOCATIONS) {
    it(`${invocation.name} -> ${invocation.expect}`, async () => {
      const server = serverFor(invocation);
      vi.stubGlobal("fetch", server.fetch);

      // A 404 or 405 from the fake surfaces as XPlantError, so this assertion
      // is what proves the path is real — not a string comparison against the
      // URL the SDK happened to build.
      await invocation.call(client());

      const call = server.calls[server.calls.length - 1];
      expect(call?.matched).not.toBeNull();
      expect(`${call?.matched?.method} ${call?.matched?.path}`).toBe(invocation.expect);
    });
  }

  it("covers every method the client exposes", () => {
    // Guards the table above from silently going stale when a resource gains a
    // method — an untested method is exactly how the 0.1.x defects shipped.
    // Resources are found by walking the client's getters, so a new resource
    // is covered by this check the moment it is added.
    const c = client();
    const resources = Object.entries(Object.getOwnPropertyDescriptors(XPlantClient.prototype))
      .filter(([, descriptor]) => typeof descriptor.get === "function")
      .map(([name]) => [name, (c as unknown as Record<string, unknown>)[name]] as const)
      .filter(([, value]) => value?.constructor?.name.endsWith("Resource"));

    expect(resources.length).toBeGreaterThanOrEqual(15);

    const exposed = resources.flatMap(([name, resource]) =>
      Object.getOwnPropertyNames(Object.getPrototypeOf(resource))
        .filter((m) => m !== "constructor")
        .map((m) => `${name}.${m}`),
    );

    const tested = new Set(INVOCATIONS.map((i) => i.name));
    expect(exposed.filter((m) => !tested.has(m))).toEqual([]);
  });
});

/**
 * The block above proves every SDK method reaches a route that's really there.
 * It cannot prove the opposite: a route with no SDK method is invisible to it
 * by construction, which is how the SDK once fell ten endpoints behind the API.
 *
 * KNOWN_UNCOVERED is an explicit allowlist, not an escape hatch: implement the
 * method, or name the endpoint here with the reason. Currently empty.
 */
describe("every route in the vendored surface is reachable by some SDK method", () => {
  const KNOWN_UNCOVERED: string[] = [];

  it("covers every endpoint except an explicit, explained allowlist", () => {
    const implemented = new Set(INVOCATIONS.map((i) => i.expect));
    const uncovered = [...ENDPOINTS.keys()].filter((key) => !implemented.has(key));
    expect(uncovered.sort()).toEqual([...KNOWN_UNCOVERED].sort());
  });

  it("never allowlists an endpoint the SDK already implements", () => {
    const implemented = new Set(INVOCATIONS.map((i) => i.expect));
    for (const key of KNOWN_UNCOVERED) {
      expect(implemented.has(key)).toBe(false);
    }
  });
});

/**
 * Whether the SDK may resend a write after a network failure is a property of
 * the endpoint — does it replay a repeated `Idempotency-Key`? — and the
 * manifest records it. These tests read that flag rather than a list kept in
 * this repo, so an endpoint gaining or losing replay fails here until the SDK
 * matches.
 */
describe("retries follow the manifest's idempotency flag", () => {
  for (const invocation of INVOCATIONS) {
    const endpoint = ENDPOINTS.get(invocation.expect);
    if (!endpoint) continue;

    if (!isWrite(invocation)) {
      it(`${invocation.name} (read) is resent after a network failure`, async () => {
        const { fetch, attempts } = flaky(serverFor(invocation));
        await invocation.call(client({ fetch, retry: { baseDelayMs: 0 } }));
        expect(attempts).toHaveLength(2);
      });
      continue;
    }

    if (endpoint.idempotent) {
      it(`${invocation.name} is resent under the same Idempotency-Key`, async () => {
        const { fetch, attempts } = flaky(serverFor(invocation));
        await invocation.call(client({ fetch, retry: { baseDelayMs: 0 } }));

        expect(attempts).toHaveLength(2);
        const key = attempts[0]["Idempotency-Key"];
        expect(key).toMatch(/^[A-Za-z0-9._:~-]{8,255}$/);
        expect(attempts[1]["Idempotency-Key"]).toBe(key);
      });

      it(`${invocation.name} runs once when the same key is sent twice`, async () => {
        const server = serverFor(invocation);
        const c = client({ fetch: server.fetch });

        await invocation.call(c, { idempotencyKey: "contract-replay-0001" });
        await invocation.call(c, { idempotencyKey: "contract-replay-0001" });

        expect(server.calls.map((call) => call.replayed)).toEqual([false, true]);
      });
    } else {
      it(`${invocation.name} is not resent after a network failure`, async () => {
        // The endpoint ignores Idempotency-Key, so a resend could store the
        // write twice. The SDK surfaces the failure instead.
        const { fetch, attempts } = flaky(serverFor(invocation));
        await expect(
          invocation.call(client({ fetch, retry: { baseDelayMs: 0 } })),
        ).rejects.toThrow("fetch failed");
        expect(attempts).toHaveLength(1);
      });
    }
  }
});

describe("device tokens reach only the endpoints that accept them", () => {
  const deviceClient = (fetchImpl: typeof fetch) =>
    new XPlantClient({ deviceToken: DEVICE_TOKEN, baseUrl: BASE_URL, fetch: fetchImpl });

  for (const invocation of INVOCATIONS) {
    const endpoint = ENDPOINTS.get(invocation.expect);
    if (!endpoint) continue;

    if (endpoint.auth === "workspace_key_or_device_token") {
      it(`${invocation.name} accepts a device token for its own device`, async () => {
        const server = serverFor(invocation, { deviceTokens: { [DEVICE_TOKEN]: DEVICE_ID } });
        await invocation.call(deviceClient(server.fetch));
        expect(server.calls[0].headers.authorization).toBe(`Bearer ${DEVICE_TOKEN}`);
      });
    } else {
      it(`${invocation.name} refuses a device token`, async () => {
        const server = serverFor(invocation, { deviceTokens: { [DEVICE_TOKEN]: DEVICE_ID } });
        const err = await invocation.call(deviceClient(server.fetch)).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(XPlantError);
        expect((err as XPlantError).status).toBe(403);
        expect((err as XPlantError).code).toBe("DEVICE_TOKEN_NOT_ACCEPTED");
      });
    }
  }

  it("refuses a device token writing about another device", async () => {
    const server = fakeXPlant({ deviceTokens: { [DEVICE_TOKEN]: DEVICE_ID } });
    const device = deviceClient(server.fetch);

    const err = await device.sensorReadings
      .createBatch([
        { device_id: DEVICE_ID, type: "temperature", value: 21, unit: "C" },
        { device_id: "d2", type: "temperature", value: 21, unit: "C" },
      ])
      .catch((e: unknown) => e);

    expect((err as XPlantError).status).toBe(403);
    expect((err as XPlantError).code).toBe("DEVICE_TOKEN_WRONG_DEVICE");
  });
});

describe("the SDK sends what the routes read", () => {
  it("looks up an external id with the route's camelCase parameter", async () => {
    const server = fakeXPlant({ responses: { "GET /api/v1/plants": [] } });
    const found = await client({ fetch: server.fetch }).plants.findByExternalId("LINE-0412");

    expect(found).toBeNull();
    expect(server.calls[0].query.get("externalId")).toBe("LINE-0412");
  });

  it("wraps a batch of readings in the bulk envelope", async () => {
    const server = fakeXPlant();
    await client({ fetch: server.fetch }).sensorReadings.createBatch([
      { device_id: DEVICE_ID, type: "ph", value: 5.8, unit: "pH", timestamp: "2026-09-25T00:00:00Z" },
    ]);

    expect(server.calls[0].body).toEqual({
      readings: [
        { device_id: DEVICE_ID, type: "ph", value: 5.8, unit: "pH", recorded_at: "2026-09-25T00:00:00Z" },
      ],
    });
  });

  it("returns null for a single reading the API recognised as a duplicate", async () => {
    // A resent reading (same device, external_id and recorded_at) is stored
    // once; the repeat answers { ok: true } with no data.
    const duplicate = (() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 }))) as unknown as typeof fetch;
    const stored = await client({ fetch: duplicate }).sensorReadings.create({
      device_id: DEVICE_ID,
      type: "ph",
      value: 5.8,
      unit: "pH",
      recorded_at: "2026-09-25T00:00:00Z",
      external_id: "gw1-ph-20260925T0000",
    });
    expect(stored).toBeNull();
  });

  it("hands back plants.create()'s warning when the first stage could not be set", async () => {
    const partly = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            data: { id: "p1", name: "Alocasia zebrina" },
            meta: { warning: "Plant saved, but its first stage could not be set." },
          }),
          { status: 201 },
        ),
      )) as unknown as typeof fetch;
    const result = await client({ fetch: partly }).plants.create({ species: "Alocasia zebrina" });

    expect(result.plant.id).toBe("p1");
    expect(result.warning).toMatch(/first stage/);
  });

  it("refuses an empty or oversized batch before sending it", async () => {
    const server = fakeXPlant();
    const c = client({ fetch: server.fetch });
    const reading = { device_id: DEVICE_ID, type: "ph" as const, value: 5.8, unit: "pH" };

    await expect(c.sensorReadings.createBatch([])).rejects.toBeInstanceOf(RangeError);
    await expect(
      c.sensorReadings.createBatch(Array.from({ length: 501 }, () => reading)),
    ).rejects.toBeInstanceOf(RangeError);
    expect(server.calls).toHaveLength(0);
  });

  it("sends the equipment event's discriminator and fields as given", async () => {
    const server = fakeXPlant();
    await client({ fetch: server.fetch }).equipment.recordEvent("eq1", {
      kind: "used",
      subject_type: "sop_log",
      subject_id: "r1",
    });

    expect(server.calls[0].path).toBe("/api/v1/equipment/eq1/events");
    expect(server.calls[0].body).toEqual({ kind: "used", subject_type: "sop_log", subject_id: "r1" });
  });
});

describe("the fake refuses the way production refuses", () => {
  it("404s a path that is not in the published surface", async () => {
    const server = fakeXPlant();
    vi.stubGlobal("fetch", server.fetch);

    await expect(client().request("/api/v1/does-not-exist")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("405s a method the route does not export", async () => {
    const server = fakeXPlant();
    vi.stubGlobal("fetch", server.fetch);

    // /api/v1/plants is GET-only.
    await expect(client().request("/api/v1/plants", { method: "DELETE" })).rejects.toMatchObject({
      status: 405,
    });
  });

  it("403s when the key lacks the scope, and names it", async () => {
    const server = fakeXPlant({ scopes: ["read:tasks"] });
    vi.stubGlobal("fetch", server.fetch);

    const err = await client()
      .tasks.create({ title: "x" })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(XPlantError);
    expect((err as XPlantError).status).toBe(403);
    expect((err as XPlantError).code).toBe("FORBIDDEN");
    expect((err as XPlantError).message).toContain("write:tasks");
  });

  it("answers me.get() for a key with no scopes at all", async () => {
    const server = fakeXPlant({ scopes: [] });
    await expect(client({ fetch: server.fetch }).me.get()).resolves.toBeDefined();
  });

  it("401s without a bearer token", async () => {
    const server = fakeXPlant();
    const res = await server.fetch(`${BASE_URL}/api/v1/tasks`);
    expect(res.status).toBe(401);
  });

  it("401s a device token it does not recognise, as a revoked one does", async () => {
    const server = fakeXPlant();
    const err = await new XPlantClient({ deviceToken: "xpd_live_revoked", baseUrl: BASE_URL, fetch: server.fetch })
      .devices.heartbeat(DEVICE_ID)
      .catch((e: unknown) => e);
    expect((err as XPlantError).status).toBe(401);
  });

  it("sends the bearer token on every call", async () => {
    const server = fakeXPlant({ responses: { "GET /api/v1/tasks": [] } });
    vi.stubGlobal("fetch", server.fetch);

    await client().tasks.list();

    expect(server.calls[0].headers.authorization).toBe("Bearer xpk_live_contract");
  });
});

describe("the vendored surface matches what the SDK was built for", () => {
  it("describes the scopes, credentials and replay of every endpoint", () => {
    for (const endpoint of V1_ENDPOINTS) {
      expect(Array.isArray(endpoint.scopes)).toBe(true);
      // Only `me` is scope-free: a key must be able to ask what it may do.
      if (endpoint.path !== "/api/v1/me") expect(endpoint.scopes.length).toBeGreaterThan(0);
      expect(["workspace_key", "workspace_key_or_device_token"]).toContain(endpoint.auth);
      expect(typeof endpoint.idempotent).toBe("boolean");
      if (endpoint.method === "GET") expect(endpoint.idempotent).toBe(false);
    }
  });

  it("exposes the routes the SDK depends on", () => {
    for (const invocation of INVOCATIONS) {
      expect(ENDPOINTS.has(invocation.expect)).toBe(true);
    }
  });
});
