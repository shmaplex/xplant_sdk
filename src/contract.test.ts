import { afterEach, describe, expect, it, vi } from "vitest";
import { XPlantClient, XPlantError } from "./client.js";
import { fakeXPlant, V1_ENDPOINTS } from "./testing/fake-xplant.js";

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

const client = () =>
  new XPlantClient({ apiKey: "xpk_live_contract", baseUrl: "https://api.test" });

afterEach(() => {
  vi.unstubAllGlobals();
});

/** One invocation per public method, with the route it is expected to reach. */
const INVOCATIONS: Array<{
  name: string;
  expect: string;
  call: (c: XPlantClient) => Promise<unknown>;
  /** Payload the route returns, when the method needs a specific one. */
  response?: unknown;
}> = [
  {
    name: "plants.list",
    expect: "GET /api/v1/plants",
    call: (c) => c.plants.list({ limit: 10 }),
  },
  {
    name: "plants.get",
    expect: "GET /api/v1/plants/{id}",
    call: (c) => c.plants.get("p1"),
  },
  {
    name: "tasks.list",
    expect: "GET /api/v1/tasks",
    call: (c) => c.tasks.list({ status: "todo" }),
  },
  {
    name: "tasks.get",
    expect: "GET /api/v1/tasks/{id}",
    call: (c) => c.tasks.get("t1"),
  },
  {
    name: "tasks.create",
    expect: "POST /api/v1/tasks",
    call: (c) => c.tasks.create({ title: "Replate N2001" }),
  },
  {
    name: "tasks.update",
    expect: "PATCH /api/v1/tasks/{id}",
    call: (c) => c.tasks.update("t1", { priority: "high" }),
  },
  {
    name: "sensorReadings.create",
    expect: "POST /api/v1/sensor-readings",
    call: (c) =>
      c.sensorReadings.create({
        device_id: "d1",
        sensor_type: "temperature",
        value: 22.5,
      }),
  },
  {
    name: "sensorReadings.list",
    expect: "GET /api/v1/sensor-readings",
    call: (c) => c.sensorReadings.list({ device_id: "d1" }),
  },
  {
    name: "devices.list",
    expect: "GET /api/v1/devices",
    call: (c) => c.devices.list(),
  },
  {
    // There is no `GET /api/v1/devices/{id}` on the server, so this lists and
    // filters client-side. The response therefore has to contain the device,
    // or the SDK raises its own 404 before the route is ever in question.
    name: "devices.get",
    expect: "GET /api/v1/devices",
    call: (c) => c.devices.get("d1"),
    response: [{ id: "d1", name: "Shelf 3" }],
  },
  {
    name: "devices.register",
    expect: "POST /api/v1/devices",
    call: (c) => c.devices.register({ device_id: "d1", name: "Shelf 3" }),
  },
  {
    name: "devices.heartbeat",
    expect: "POST /api/v1/devices/{deviceId}/heartbeat",
    call: (c) => c.devices.heartbeat("d1"),
  },
  {
    name: "labels.resolve",
    expect: "GET /api/v1/labels/resolve",
    call: (c) => c.labels.resolve("XP-0001"),
  },
];

describe("every SDK method reaches a route that exists", () => {
  for (const invocation of INVOCATIONS) {
    it(`${invocation.name} -> ${invocation.expect}`, async () => {
      const server = fakeXPlant({
        responses: { [invocation.expect]: invocation.response ?? [] },
      });
      vi.stubGlobal("fetch", server.fetch);

      // A 404 or 405 from the fake surfaces as XPlantError, so this assertion
      // is what proves the path is real — not a string comparison against the
      // URL the SDK happened to build.
      await invocation.call(client());

      const call = server.calls.at(-1);
      expect(call?.matched).not.toBeNull();
      expect(`${call?.matched?.method} ${call?.matched?.path}`).toBe(
        invocation.expect,
      );
    });
  }

  it("covers every method the client exposes", () => {
    // Guards the table above from silently going stale when a resource gains a
    // method — an untested method is exactly how the 0.1.x defects shipped.
    const c = client();
    const resources = {
      plants: c.plants,
      tasks: c.tasks,
      devices: c.devices,
      sensorReadings: c.sensorReadings,
      labels: c.labels,
    };

    const exposed = Object.entries(resources).flatMap(([name, resource]) =>
      Object.getOwnPropertyNames(Object.getPrototypeOf(resource))
        .filter((m) => m !== "constructor")
        .map((m) => `${name}.${m}`),
    );

    const tested = new Set(INVOCATIONS.map((i) => i.name));
    expect(exposed.filter((m) => !tested.has(m))).toEqual([]);
  });
});

describe("the fake refuses the way production refuses", () => {
  it("404s a path that is not in the published surface", async () => {
    const server = fakeXPlant();
    vi.stubGlobal("fetch", server.fetch);

    await expect(
      client().request("/api/v1/does-not-exist"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("405s a method the route does not export", async () => {
    const server = fakeXPlant();
    vi.stubGlobal("fetch", server.fetch);

    // /api/v1/plants is GET-only.
    await expect(
      client().request("/api/v1/plants", { method: "DELETE" }),
    ).rejects.toMatchObject({ status: 405 });
  });

  it("403s when the key lacks the scope, and names it", async () => {
    const server = fakeXPlant({ scopes: ["read:tasks"] });
    vi.stubGlobal("fetch", server.fetch);

    const err = await client()
      .tasks.create({ title: "x" })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(XPlantError);
    expect((err as XPlantError).status).toBe(403);
    expect((err as XPlantError).message).toContain("write:tasks");
  });

  it("401s without a bearer token", async () => {
    const server = fakeXPlant();
    vi.stubGlobal("fetch", server.fetch);

    const res = await server.fetch("https://api.test/api/v1/tasks");
    expect(res.status).toBe(401);
  });

  it("sends the bearer token on every call", async () => {
    const server = fakeXPlant({ responses: { "GET /api/v1/tasks": [] } });
    vi.stubGlobal("fetch", server.fetch);

    await client().tasks.list();

    expect(server.calls[0].headers.authorization).toBe("Bearer xpk_live_contract");
  });
});

describe("the vendored surface matches what the SDK was built for", () => {
  it("carries a scope and a guard for every endpoint", () => {
    for (const endpoint of V1_ENDPOINTS) {
      expect(endpoint.scopes.length).toBeGreaterThan(0);
      expect(["authorizeV1", "inline"]).toContain(endpoint.guard);
    }
  });

  it("exposes the routes the SDK depends on", () => {
    const keys = new Set(V1_ENDPOINTS.map((e) => `${e.method} ${e.path}`));
    for (const invocation of INVOCATIONS) {
      expect(keys).toContain(invocation.expect);
    }
  });
});
