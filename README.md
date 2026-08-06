<p align="center">
  <img src=".github/github-header.png" alt="xplant_sdk" width="full"/>
</p>
<p align="center">
Official JavaScript/TypeScript SDK for the [xPlant](https://www.xplantpro.com) external API.
</p>

---
Connect sensors, Raspberry Pis, Arduino devices, scripts, and external tools to your xPlant lab workspace.

[![npm version](https://img.shields.io/npm/v/@shmaplex/xplant-sdk)](https://www.npmjs.com/package/@shmaplex/xplant-sdk)
[![CI](https://github.com/shmaplex/xplant-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/shmaplex/xplant-sdk/actions/workflows/ci.yml)
[![License: CSL v1.1](https://img.shields.io/badge/license-CSL%20v1.1-green)](https://github.com/shmaplex/csl)

> **Note:** This package is temporarily published as `@shmaplex/xplant-sdk`.
> It will be re-published as `@xplant/sdk` once the `@xplant` npm org is available.
> A deprecation notice and migration guide will be added at that time — no API changes required.

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

Go to **xPlant → Settings → Integrations → API Keys** and create a key with the scopes your integration needs.

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
```

---

## Resources

### `client.sensorReadings`

```typescript
// Post a reading (write:sensor_readings scope)
await client.sensorReadings.create({
  device_id: "device-uuid",
  type: "temperature", // "temperature" | "humidity" | "co2" | "light_lux" | "ph" | "ec"
  value: 24.5,
  unit: "C", // "C" | "F" | "%" | "ppm" | "lux" | "pH" | "mS/cm"
  timestamp: "2026-08-06T12:00:00Z", // ISO 8601 — defaults to now if omitted
});

// List recent readings for a device (read:sensor_readings scope)
const readings = await client.sensorReadings.list("device-uuid");
```

### `client.devices`

```typescript
// Heartbeat — confirms device is online (write:devices scope)
await client.devices.heartbeat("device-uuid");

// Get device metadata (read:devices scope)
const device = await client.devices.get("device-uuid");
```

> Device *registration* (`POST /api/v1/devices`) exists server-side but has no
> `DevicesResource` wrapper yet in this SDK version — call it directly with
> `client.request("/api/v1/devices", { method: "POST", body: JSON.stringify({ ... }) })`
> in the meantime.

### `client.plants`

```typescript
// List plants for the workspace (read:plants scope)
const plants = await client.plants.list();

// Get a single plant
const plant = await client.plants.get("plant-uuid");
```

### `client.tasks`

```typescript
// List tasks for the workspace (read:tasks scope)
const tasks = await client.tasks.list();

// Create a task — priority and assigned_to route work from your own data (write:tasks scope)
const task = await client.tasks.create({
  title: "Replate N2001",
  category: "transfer",
  priority: "urgent",
  assigned_to: "teammate-uuid",
});

// Update a task — only supplied fields change (write:tasks scope)
await client.tasks.update(task.id, { priority: "high" });
```

### `client.labels`

```typescript
// Resolve a QR/barcode scan to an xPlant record (read:labels scope)
const result = await client.labels.resolve("QR_CODE_STRING");
// result.record_type → "plant" | "explant"
// result.record_id   → UUID of the matched record
// result.url         → in-app path, e.g. "/dashboard/plants/{id}"
```

---

## Error handling

```typescript
import { XPlantClient, XPlantError } from "@shmaplex/xplant-sdk";

try {
  await client.sensorReadings.create({ ... });
} catch (err) {
  if (err instanceof XPlantError) {
    console.error(`API error ${err.status} (${err.code}):`, err.body);
    // err.status === 401, err.code === "UNAUTHORIZED" → missing, malformed, or revoked key
    // err.status === 403, err.code === "FORBIDDEN"    → key missing the required scope
    // err.status === 404, err.code === "NOT_FOUND"    → record doesn't exist, or belongs to another workspace
    // err.status === 422, err.code === "VALIDATION_ERROR" → body failed validation; err.body names the field
  }
  throw err;
}
```

`err.code` is the stable, machine-readable code from the API's response envelope — prefer it over `err.status` alone when branching on a specific failure, since `err.body` is a human-readable message that may be reworded between releases.

---

## TypeScript

Full type definitions are included — no `@types/` package needed.

```typescript
import type {
  SensorReadingPayload,
  SensorReading,
  PlantSummary,
  TaskSummary,
  TaskCreatePayload,
  TaskUpdatePayload,
  TaskPriority,
  TaskCategory,
  WorkflowStatus,
  LabelResolveResult,
  XPlantApiResponse,
} from "@shmaplex/xplant-sdk";
```

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
