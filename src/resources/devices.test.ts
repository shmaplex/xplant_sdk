import { afterEach, describe, expect, it, vi } from "vitest";
import { XPlantClient, XPlantError } from "../client.js";
import type { DeviceSummary } from "../types.js";

const device = (id: string): DeviceSummary => ({
  id,
  name: "Growth Room 1 — Temp/Humidity",
  type: "sensor",
  hardware: "esp32",
  status: "active",
  firmware_version: "1.2.0",
  room_id: null,
  last_seen_at: "2026-08-06T00:00:00.000Z",
  metadata: {},
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-08-06T00:00:00.000Z",
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

describe("devices", () => {
  it("registers a device and returns the created record", async () => {
    const calls = stubFetch({ ok: true, data: device("d1") }, 201);

    const created = await client().devices.register({
      name: "Growth Room 1 — Temp/Humidity",
      type: "sensor",
      hardware: "esp32",
    });

    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].url).toBe("https://www.xplantpro.com/api/v1/devices");
    expect(created.id).toBe("d1");
    expect(created.status).toBe("active");
  });

  it("returns received_at from a heartbeat", async () => {
    stubFetch({ ok: true, data: { received_at: "2026-08-06T12:00:00.000Z" } });

    const result = await client().devices.heartbeat("d1");

    expect(result.received_at).toBe("2026-08-06T12:00:00.000Z");
  });

  it("resolves get() against the device list", async () => {
    const calls = stubFetch({ ok: true, data: [device("d1"), device("d2")] });

    const found = await client().devices.get("d2");

    // There is no single-device route, so this must hit the collection.
    expect(calls[0].url).toBe("https://www.xplantpro.com/api/v1/devices");
    expect(found.id).toBe("d2");
  });

  it("raises a 404 XPlantError for a device outside the workspace", async () => {
    stubFetch({ ok: true, data: [device("d1")] });

    const err = await client()
      .devices.get("nope")
      .catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(XPlantError);
    expect((err as XPlantError).status).toBe(404);
    expect((err as XPlantError).code).toBe("NOT_FOUND");
  });
});
