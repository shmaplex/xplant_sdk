<p align="center">
  <img src=".github/github-header.png" alt="xplant_sdk" width="full"/>
</p>
<p align="center">
Official JavaScript/TypeScript SDK for the [xPlant](https://xplantpro.com) external API.
</p>

---
Connect sensors, Raspberry Pis, Arduino devices, scripts, and external tools to your xPlant lab workspace.

[![npm version](https://img.shields.io/npm/v/@shmaplex/xplant-sdk)](https://www.npmjs.com/package/@shmaplex/xplant-sdk)
[![CI](https://github.com/shmaplex/xplant-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/shmaplex/xplant-sdk/actions/workflows/ci.yml)
[![License: CSL v1.1](https://img.shields.io/badge/license-CSL%20v1.1-green)](https://github.com/shmaplex/csl)

> **Note:** This package is temporarily published as `@shmaplex/xplant-sdk`.
> It will be re-published as `@xplant/sdk` once the `@xplant` npm org is available.
> A deprecation notice and migration guide will be added at that time — no API changes required.

> **This repository is the canonical source for the `@shmaplex/xplant-sdk` npm
> package.** `shmaplex/xplant_os` (`packages/js-sdk`) is a separate, older copy
> that must never be published under the `@shmaplex/xplant-sdk` name — the two
> diverged and npm briefly served the stale one (see [#4](https://github.com/shmaplex/xplant-sdk/issues/4)).
> Publishes to that name happen from this repository's `main` branch only.

---

## Installation

```bash
npm install @shmaplex/xplant-sdk
```

```bash
yarn add @shmaplex/xplant-sdk
```

```bash
pnpm add @shmaplex/xplant-sdk
```

Requires **Node.js 18+**. Works in browser environments too (uses the native `fetch` API).

---

## Quick start

### 1. Get an API key

Go to **xPlant → [Settings → Integrations → API Keys](https://www.xplantpro.com/settings/integrations)** and create a key with the scopes your integration needs.

Keep your key out of version control — use an environment variable:

```bash
export XPLANT_API_KEY="xpk_live_your_key_here"
```

### 2. Install and use

```typescript
import { XPlantClient } from "@shmaplex/xplant-sdk";

const client = new XPlantClient({
  apiKey: process.env.XPLANT_API_KEY!,
});

// Post a temperature reading from a sensor
await client.sensorReadings.create({
  device_id: "your-device-uuid",
  type: "temperature",
  value: 24.5,
  unit: "C",
});

// Send a heartbeat to confirm the device is online
await client.devices.heartbeat("your-device-uuid");

// Read plants in your workspace
const plants = await client.plants.list();

// Queue bench work
await client.tasks.create({
  title: "Replate N2001 — second pass",
  category: "transfer",
  priority: "high",
});
```

The client targets `https://www.xplantpro.com` by default. Pass `baseUrl` only to
point at a development server.

---

## Response shape

Every `/api/v1` route wraps its payload in an envelope:

```jsonc
// success
{ "ok": true, "data": { /* … */ } }

// failure
{ "ok": false, "data": null, "error": "Task not found", "code": "NOT_FOUND" }
```

Resource methods unwrap this for you — `client.plants.list()` resolves to a
`PlantSummary[]`, not to the envelope. A failure envelope is raised as an
`XPlantError`, never handed back as data.

When you need the envelope itself (for `meta`), use the escape hatch:

```typescript
const envelope = await client.requestEnvelope<PlantSummary[]>("/api/v1/plants");
envelope.data; // PlantSummary[]
envelope.meta; // Record<string, unknown> | undefined
```

---

## Resources

### `client.sensorReadings`

```typescript
// Post a reading (write:sensor_readings scope)
await client.sensorReadings.create({
  device_id: string;
  type: "temperature" | "humidity" | "ph" | "co2" | "light" | "other";
  value: number;
  unit: string;          // "C", "%", "ppm", "lux", "pH", "mS/cm" — 1–20 chars
  recorded_at?: string;  // ISO 8601 — defaults to now
  room_id?: string;
  notes?: string;
});

// List recent readings, newest first (read:sensor_readings scope)
const readings = await client.sensorReadings.list("device-uuid");
const recent = await client.sensorReadings.list({
  room_id: "room-uuid",
  type: "temperature",
  since: "2026-08-01T00:00:00Z",
  limit: 500,           // defaults to 100, capped at 1000
});
```

### `client.devices`

```typescript
// Heartbeat — confirms device is online (write:devices scope)
const { received_at } = await client.devices.heartbeat("device-uuid");

// Register a new device (write:devices scope)
await client.devices.register({
  name: "Growth Room 1 — Temp/Humidity",
  type: "sensor",          // "sensor" | "controller" | "gateway"
  hardware: "esp32",
});

// List devices, or fetch one (read:devices scope)
const devices = await client.devices.list();
const device = await client.devices.get("device-uuid");

// Record a device event — alert, firmware update, config change, etc.
// (write:device_events scope)
await client.devices.recordEvent({
  device_id: "device-uuid",
  event_type: "alert",     // heartbeat | alert | firmware_update | config_change | error | other
  payload: { message: "Sensor offline" },
});
```

### `client.plants`

```typescript
// List plants, newest first (read:plants scope)
const plants = await client.plants.list({ limit: 50, offset: 0 });

// Get a single plant
const plant = await client.plants.get("plant-uuid");
```

Paging is offset-based and returns no total — a page shorter than `limit` is the
last page. `limit` defaults to 50 and is capped at 200.

### `client.tasks`

```typescript
// List tasks, soonest due first (read:tasks scope)
const tasks = await client.tasks.list({ status: "todo", limit: 50 });
const mine = await client.tasks.list({ assigned_to: userId });

// Get a single task
const task = await client.tasks.get("task-uuid");

// Create a task (write:tasks scope)
const created = await client.tasks.create({
  title: "Replate N2001 — second pass",
  category: "transfer",        // media_prep | transfer | contamination | subculture
                               // | sop_review | acclimation | cleaning | monitoring | other
  priority: "high",            // low | medium | high | urgent
  workflow_status: "todo",     // backlog | todo | in_progress | waiting_blocked | review | done
  due_date: "2026-08-10T09:00:00Z",
  assigned_to: userId,         // must be an active member of the key's workspace
});

// Update a task (write:tasks scope)
const result = await client.tasks.update(created.id, { priority_rank: 1500 });
```

#### Ordering, and the manual-override rule

`priority` is the label; `priority_rank` is the queue position — lower sorts
first, and it is fractional, so a scheduler can drop a task between two
neighbours without renumbering. Send `priority_rank: null` to clear a position
and let the label decide.

**A write over this API counts as automatic, and an automated write never
overwrites an order somebody set by hand.** If a task's `priority_source` is
`manual`, the ordering part of your patch is skipped — the request still
succeeds with 200 and the rest of the patch still applies.

That skip is reported rather than swallowed, so a nightly sync can tell the
difference between "applied" and "silently ignored":

```typescript
const result = await client.tasks.update(taskId, { priority_rank: 1500 });

result.task;           // the task as stored — the order that won, not what you sent
result.skipped;        // true when the manual-override rule declined the change
result.priority_write; // { applied, reason, priority_source, message } | null

if (result.skipped) {
  console.warn(result.priority_write?.message);
  // → "Left this task where someone put it by hand. Send release: true to
  //    hand it back to automatic ordering."
}
```

To take a hand-ordered task back under automatic control, send `release: true`:

```typescript
await client.tasks.update(taskId, { priority_rank: 1500, release: true });
```

`priority_source` is returned on every task and says who owns the order:
`default` (never positioned), `auto` (set by an integration), or `manual` (set
by a person). `priority_write` is `null` when the request attempted no ordering
change.

### `client.labels`

```typescript
// Resolve a QR/barcode scan to an xPlant record (read:labels scope)
const result = await client.labels.resolve("QR_CODE_STRING");
// result.record_type   → "plant" | "explant"
// result.record_id     → UUID of the matched record
// result.display_name  → human-readable label
// result.url           → relative in-app path, e.g. "/dashboard/plants/<id>"
```

A code that matches nothing in the workspace raises an `XPlantError` with
status 404.

### `client.explants`

```typescript
// List explants (batches), newest first (read:explants scope)
const explants = await client.explants.list({ limit: 50 });

// Resolve the customer's own batch identifier (e.g. "N2001") to its record
const [batch] = await client.explants.list({ externalId: "N2001" });

// Get a single explant
const explant = await client.explants.get("explant-uuid");
```

### `client.events`

```typescript
// Change history for a plant or explant lineage, oldest first
// (read:events scope). `entity` is required.
const events = await client.events.list({ entity: "explant" });

// Pull only what's new since your last sync
const delta = await client.events.list({
  entity: "explant",
  since: lastEventCreatedAt,
});
```

### `client.stages`

```typescript
// Stage history for a plant or explant, most recent first
// (read:transfers scope) — pass exactly one of plant_id / explant_id
const history = await client.stages.list({ explant_id: "explant-uuid" });

// Advance to a new tissue-culture stage (write:transfers scope)
const stage = await client.stages.advance({
  explant_id: "explant-uuid",
  stage: "rooting",
  room_id: "room-uuid",
});
```

### `client.transfers`

```typescript
// Transfer history for a plant or explant, most recent first
// (read:transfers scope) — pass exactly one of plant_id / explant_id
const transfers = await client.transfers.list({ explant_id: "explant-uuid" });

// Record a transfer — subculture to fresh media (write:transfers scope)
// transfer_cycle auto-increments from the entity's last transfer unless supplied.
await client.transfers.create({
  explant_id: "explant-uuid",
  to_location: "Shelf 3",
});
```

### `client.taskDemand`

```typescript
// Recent demand signals, newest first (read:tasks scope)
const signals = await client.taskDemand.list({ genus: "Phalaenopsis" });

// Just the latest reading for a genus
const [current] = await client.taskDemand.list({
  genus: "Phalaenopsis",
  current: true,
});

// Push a demand number (write:demand scope — separate from write:tasks so a
// demand-only integration doesn't also get task write access)
await client.taskDemand.record({
  genus: "Phalaenopsis",
  demand_score: 42,
  source: "shop-orders",
});
```

---

## Error handling

```typescript
import { XPlantClient, XPlantError } from "@shmaplex/xplant-sdk";

try {
  await client.sensorReadings.create({ ... });
} catch (err) {
  if (err instanceof XPlantError) {
    console.error(`API error ${err.status} (${err.code}):`, err.message);
    // err.status === 401 → check your API key
    // err.status === 403 → key missing a scope; err.message names it
    // err.status === 404 → not found, or outside the key's workspace
    // err.status === 422 → validation failed; err.message names the field
  }
  throw err;
}
```

`err.code` is stable and safe to branch on — `UNAUTHORIZED`, `FORBIDDEN`,
`NOT_FOUND`, `VALIDATION_ERROR`, and the `*_FAILED` server codes. It is `null`
when a gateway answered instead of the app. `err.message` is human-readable and
may be reworded; `err.body` holds the raw response text.

Two quirks worth coding around: the device and sensor-reading routes return
`code: "UNAUTHORIZED"` for 403 as well as 401, and a record outside your
workspace returns 404 rather than 403.

> **Note:** a task ordering change declined by the manual-override rule is a
> **success, not an error** — nothing throws. Check `result.skipped` on
> `tasks.update()`.

---

## TypeScript

Full type definitions are included — no `@types/` package needed.

```typescript
import type {
  SensorReadingPayload,
  SensorReading,
  DeviceSummary,
  DeviceRegisterPayload,
  DeviceEventPayload,
  DeviceEvent,
  PlantSummary,
  TaskSummary,
  TaskCreateInput,
  TaskUpdateInput,
  TaskUpdateResult,
  PriorityWriteReport,
  PrioritySource,
  LabelResolveResult,
  ExplantSummary,
  ExplantListParams,
  EventSummary,
  EventListParams,
  StageSummary,
  StageAdvanceInput,
  TransferSummary,
  TransferCreateInput,
  DemandSignalSummary,
  TaskDemandCreateInput,
  XPlantApiResponse,
} from "@shmaplex/xplant-sdk";
```

---

## Upgrading to 0.3.0

0.3.0 is additive — no breaking changes. It adds five resources
(`client.events`, `client.explants`, `client.stages`, `client.transfers`,
`client.taskDemand`) and `client.devices.recordEvent()`, closing the gap
between the vendored API surface and what the SDK implemented. See
[CHANGELOG.md](CHANGELOG.md).

---

## Upgrading to 0.2.0

0.2.0 corrects behaviour that never matched the running API. See
[CHANGELOG.md](CHANGELOG.md) for the full list. The two changes that touch
existing code:

- **Resource methods now return records, not the envelope.** Code that reached
  through `.data` (`(await client.plants.list()).data`) should drop that step.
  Code that read `plants[0].name` and got `undefined` now works.
- **The default host moved to `https://www.xplantpro.com`.** Clients that passed
  an explicit `baseUrl` are unaffected.

---

## Hardware examples

See the [xplant_os](https://github.com/shmaplex/xplant_os) repository for complete hardware examples:

- **ESP32 + DHT22/BME280** — temperature and humidity sensor posting to xPlant
- **Raspberry Pi gateway** — Python bridge for MQTT/serial sensors
- **ESPHome** — YAML config templates
- **Tasmota** — webhook rules

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

---

## License

Licensed under the [Common Sense License (CSL) v1.1](https://github.com/shmaplex/csl).

- Free for individuals, nonprofits, researchers, and businesses under $10M revenue.
- Large-scale commercial users must contribute back proportionally (13.37% of attributable revenue).
- Ethical use restrictions apply.

```
Copyright (C) 2025 Shmaplex

This source code is licensed under the Common Sense License (CSL) v1.1.
You may obtain a copy of the license at: https://github.com/shmaplex/csl
```
