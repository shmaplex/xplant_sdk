<p align="center">
  <img src=".github/github-header.png" alt="xplant_sdk" width="full"/>
</p>
<p align="center">
Official JavaScript/TypeScript SDK for the [xPlant](https://xplantpro.com) external API.
</p>

---
Connect sensors, Raspberry Pis, Arduino devices, scripts, and external tools to your xPlant lab workspace.

[![npm version](https://img.shields.io/npm/v/@shmaplex/xplant-sdk)](https://www.npmjs.com/package/@shmaplex/xplant-sdk)
[![CI](https://github.com/shmaplex/xplant_sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/shmaplex/xplant_sdk/actions/workflows/ci.yml)
[![License: CSL v1.1](https://img.shields.io/badge/license-CSL%20v1.1-green)](https://github.com/shmaplex/csl)

> **Note:** This package is temporarily published as `@shmaplex/xplant-sdk`.
> It will be re-published as `@xplant/sdk` once the `@xplant` npm org is available.
> A deprecation notice and migration guide will be added at that time — no API changes required.

> **This repository is the canonical source for the `@shmaplex/xplant-sdk` npm
> package.** `shmaplex/xplant_os` (`packages/js-sdk`) is a separate, older copy
> that must never be published under the `@shmaplex/xplant-sdk` name — the two
> diverged and npm briefly served the stale one (see [#4](https://github.com/shmaplex/xplant_sdk/issues/4)).
> Publishes to that name happen from this repository's `main` branch only.

---

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Authentication and scopes](#authentication-and-scopes)
- [Response shape](#response-shape)
- [Resources](#resources) — every endpoint, with an example
- [Paging](#paging)
- [Errors](#errors)
- [Rate limits and retries](#rate-limits-and-retries)
- [Idempotency](#idempotency)
- [Device tokens](#device-tokens)
- [TypeScript](#typescript)
- [Upgrading from 0.1.0](#upgrading-from-010)

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

Go to **xPlant → [Settings → Integrations → API Keys](https://app.xplantpro.com/settings/integrations/api-keys)**
and create a key with the scopes your integration needs.

Keep your key out of version control — use an environment variable:

```bash
export XPLANT_API_KEY="xpk_live_your_key_here"
```

### 2. Install and use

```typescript
import { XPlantClient } from "@shmaplex/xplant-sdk";

const client = new XPlantClient({ apiKey: process.env.XPLANT_API_KEY });

// What can this key do?
const me = await client.me.get();
console.log(me.key.name, me.scopes);

// Read plants in your workspace
const plants = await client.plants.list();

// Queue bench work
await client.tasks.create({
  title: "Replate N2001 — second pass",
  category: "transfer",
  priority: "high",
});
```

The client targets `https://app.xplantpro.com` by default. Pass `baseUrl` only
to point at a development server.

### Client options

```typescript
new XPlantClient({
  apiKey: process.env.XPLANT_API_KEY,  // a workspace key: xpk_live_… / xpk_dev_…
  // deviceToken: "xpd_live_…",        // on a device, instead of apiKey — see Device tokens
  baseUrl: "https://app.xplantpro.com", // the default
  retry: true,                          // opt in to retries — see Rate limits and retries
  fetch: customFetch,                   // optional; defaults to the global fetch
});
```

Every method also takes a final options object: `{ signal }` for reads, and
`{ signal, idempotencyKey }` for writes.

---

## Authentication and scopes

Every request carries a bearer credential. There are two kinds:

| Credential | Prefix | Can do | Where it belongs |
|---|---|---|---|
| **Workspace API key** | `xpk_live_` / `xpk_dev_` | Whatever its scopes allow, across the workspace | A server, a script, an integration you control |
| **Device token** | `xpd_live_` / `xpd_dev_` | Post **its own device's** readings, events and heartbeat — nothing else | The device itself |

> **Never put a workspace API key on a device.** A key on a Raspberry Pi in a
> shared grow room can read and change the whole lab. Give each device its own
> [device token](#device-tokens) instead.

A key without the scope an endpoint needs gets `403 FORBIDDEN`, and the error
message names the missing scope. `client.me.get()` needs no scope and returns
every scope the key holds, so an integration can check before it starts.

| Scope | Grants | SDK methods |
|---|---|---|
| *(none)* | Describe the key itself | `me.get` |
| `read:workspace` | Read workspace and lab settings | `workspaces.list` |
| `read:plants` | Read plant records | `plants.list`, `plants.get`, `plants.findByExternalId` |
| `write:plants` | Create and update plant records | *No endpoint yet* |
| `read:explants` | Read explant records | `explants.list`, `explants.get`, `explants.findByExternalId` |
| `write:explants` | Create and update explant records | *No endpoint yet* |
| `read:transfers` | Read transfer and stage history | `stages.list`, `transfers.list` |
| `write:transfers` | Record transfers and advance stages | `stages.advance`, `transfers.create` |
| `read:events` | Read plant and explant change history | `events.list` |
| `read:tasks` | Read tasks and demand signals | `tasks.list`, `tasks.get`, `taskDemand.list` |
| `write:tasks` | Create and update tasks | `tasks.create`, `tasks.update` |
| `write:demand` | Push demand numbers per genus | `taskDemand.record` |
| `read:sops` | Read SOPs and the version in force | `sops.list`, `sops.get` |
| `read:sop_runs` | Read SOP run history | `sopRuns.get` |
| `write:sop_runs` | Start SOP runs | `sopRuns.start` |
| `write:sop_steps` | Post evidence against SOP run steps | `sopRuns.recordStepEvent`, `sopRuns.recordMeasurement` |
| `read:labels` | Resolve QR/barcode codes to records | `labels.resolve` |
| `write:label_scans` | Record label scans | `labels.recordScan` |
| `read:devices` | List devices and their tokens | `devices.list`, `devices.get`, `devices.listTokens` |
| `write:devices` | Register devices, send heartbeats, create device tokens | `devices.register`, `devices.heartbeat`, `devices.createToken` |
| `write:device_events` | Record device events | `devices.recordEvent` |
| `read:sensor_readings` | Query sensor readings | `sensorReadings.list` |
| `write:sensor_readings` | Submit sensor readings | `sensorReadings.create`, `sensorReadings.createBatch` |
| `write:equipment_events` | Record equipment use and maintenance | `equipment.recordEvent` |
| `read:equipment` | Read the equipment library | *No endpoint yet* |
| `read:contaminations` / `write:contaminations` | Contamination logs | *No endpoint yet* |
| `read:comments` / `write:comments` | Notes and comments on records | *No endpoint yet* |
| `read:assets` / `write:assets` | Photos and media on records | *No endpoint yet* |
| `read:media_recipes` / `write:media_recipes` | Media recipes | *No endpoint yet* |
| `read:pricing` | Culture line pricing | *No endpoint yet* |
| `read:commerce` | Store order lines and sell-through | *No endpoint yet* |

A device token carries no scopes: it may use only `devices.heartbeat`,
`devices.recordEvent`, `sensorReadings.create` and `sensorReadings.createBatch`,
and only for the device it is bound to.

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

Field names are the API's own, so casing follows the endpoint: the plant,
explant, task, stage, transfer, device and sensor records use `snake_case`;
`me`, SOPs, SOP runs, device tokens, label scans and equipment events use
`camelCase`.

When you need the envelope itself (for `meta`), use the escape hatch:

```typescript
const envelope = await client.requestEnvelope<PlantSummary[]>("/api/v1/plants");
envelope.data; // PlantSummary[]
envelope.meta; // Record<string, unknown> | undefined
```

---

## Resources

Each heading gives the endpoint and the scope it needs. The examples assume a
`client` built with a workspace key, or a `device` built with a device token.

### `client.me` — who am I

```typescript
// GET /api/v1/me — no scope needed
const me = await client.me.get();
me.key;        // { id, name, prefix, environment, status, lastUsedAt, createdAt }
me.scopes;     // ["read:plants", "write:tasks", …]
me.workspace;  // { id }
me.user;       // { id }
```

### `client.workspaces`

```typescript
// GET /api/v1/workspaces — read:workspace
const [workspace] = await client.workspaces.list();
console.log(workspace.id, workspace.name, workspace.type);
```

A key is created in one workspace and acts only there, so this list has exactly
one entry.

### `client.plants`

```typescript
// GET /api/v1/plants — read:plants. Newest first; limit defaults to 50, max 200.
const plants = await client.plants.list({ limit: 50, offset: 0 });

// GET /api/v1/plants/{id}
const plant = await client.plants.get("plant-uuid");

// Resolve your own identifier (e.g. "N2001") — resolves to the plant or null
const n2001 = await client.plants.findByExternalId("N2001");
```

### `client.explants`

```typescript
// GET /api/v1/explants — read:explants. Newest first.
const batches = await client.explants.list({ limit: 50 });

// GET /api/v1/explants/{id}
const batch = await client.explants.get("explant-uuid");

// Resolve your own batch identifier — resolves to the batch or null
const n2001 = await client.explants.findByExternalId("N2001");
```

### `client.stages`

Pass exactly one of `plant_id` or `explant_id`.

```typescript
// GET /api/v1/stages — read:transfers. Most recent first.
const history = await client.stages.list({ explant_id: "explant-uuid" });

// POST /api/v1/stages — write:transfers. Completes the current stage and starts the new one.
const stage = await client.stages.advance({
  explant_id: "explant-uuid",
  stage: "rooting",
  entered_on: "2026-09-25",   // optional; defaults to today
  room_id: "room-uuid",       // optional
  notes: "12 jars",           // optional
});
```

### `client.transfers`

```typescript
// GET /api/v1/transfers — read:transfers. Most recent first.
const transfers = await client.transfers.list({ explant_id: "explant-uuid" });

// POST /api/v1/transfers — write:transfers. A subculture onto fresh media.
await client.transfers.create({
  explant_id: "explant-uuid",
  to_location: "Shelf 3",
  notes: "Clean, no browning",
  // transfer_cycle continues from the last recorded cycle unless you set it
});
```

### `client.events` — change history

```typescript
// GET /api/v1/events — read:events. Oldest first. `entity` is required.
const events = await client.events.list({ entity: "explant" });

// Pull only what's new: save the newest created_at and pass it back as `since`
let since = events[events.length - 1]?.created_at;
const delta = await client.events.list({ entity: "explant", since });
```

Plant and explant history are paged separately — call once per entity type.

### `client.tasks`

```typescript
// GET /api/v1/tasks — read:tasks. Soonest due first.
const todo = await client.tasks.list({ status: "todo", limit: 50 });
const mine = await client.tasks.list({ assigned_to: userId });

// GET /api/v1/tasks/{id} — includes entity_link, the plant or explant it is about
const task = await client.tasks.get("task-uuid");

// POST /api/v1/tasks — write:tasks
const created = await client.tasks.create({
  title: "Replate N2001 — second pass",
  category: "transfer",        // media_prep | transfer | contamination | subculture
                               // | sop_review | acclimation | cleaning | monitoring | other
  priority: "high",            // low | medium | high | urgent
  workflow_status: "todo",     // backlog | todo | in_progress | waiting_blocked | review | done
  due_date: "2026-10-01T09:00:00+09:00", // ISO 8601 with an offset
  is_all_day: false,
  assigned_to: userId,         // must be an active member of the key's workspace
  genus: "Nepenthes",
  entity_type: "explant",      // link to a culture: send entity_type and entity_id together
  entity_id: "explant-uuid",
});

// PATCH /api/v1/tasks/{id} — write:tasks. Returns { task, priority_write, skipped }.
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
change. To remove a task's culture link, send `clear_entity_link: true`.

### `client.taskDemand` — demand signals

```typescript
// GET /api/v1/tasks/demand — read:tasks. Newest first.
const signals = await client.taskDemand.list({ genus: "Nepenthes" });

// Just the current reading for one genus
const [current] = await client.taskDemand.list({ genus: "Nepenthes", current: true });

// POST /api/v1/tasks/demand — write:demand, kept separate from write:tasks so a
// demand-only integration doesn't also get task writes
await client.taskDemand.record({
  genus: "Nepenthes",
  demand_score: 42,
  source: "web-store",
  source_type: "tissue",                      // optional
  observed_at: "2026-09-25T00:00:00+09:00",   // optional, with an offset
});
```

### `client.sops` — protocols

```typescript
// GET /api/v1/sops — read:sops. Summaries, most recently updated first.
const sops = await client.sops.list({ limit: 20 });

// GET /api/v1/sops/{id} — the protocol and the version the lab works from
const sop = await client.sops.get("sop-uuid");
if (!sop.version) {
  throw new Error(`${sop.title} has no version in force`);
}
console.log(sop.version.version, sop.version.steps);
```

`version` is only ever the version in force — never a draft, and never an
approved version that has not taken effect. It is `null` when there is none.

### `client.sopRuns` — running a protocol

```typescript
// POST /api/v1/sop-runs — write:sop_runs. Always pinned to the version in force.
const run = await client.sopRuns.start({ sop_id: "sop-uuid", batch_code: "N2001" });

// POST /api/v1/sop-runs/{id}/steps/{stepId}/events — write:sop_steps
await client.sopRuns.recordStepEvent(run.id, "step-3", {
  event_type: "scanned",       // confirmed | scanned | skipped | note | device_state
  payload: { barcode: "XPL-2025-001" },
});

// POST /api/v1/sop-runs/{id}/steps/{stepId}/measurements — write:sop_steps
await client.sopRuns.recordMeasurement(run.id, "step-4", {
  metric: "ph",
  value: 5.7,
  unit: "pH",                  // required — there is no default unit
});

// GET /api/v1/sop-runs/{id} — read:sop_runs. Step states and evidence, oldest first.
const detail = await client.sopRuns.get(run.id);
```

Evidence is append-only. A protocol with no version in force answers
`409 SOP_RUN_NOT_EFFECTIVE`; a completed run answers `409 SOP_RUN_CLOSED`.

### `client.labels` — scanning

```typescript
// GET /api/v1/labels/resolve — read:labels
const hit = await client.labels.resolve("XPL-2025-001");
hit.record_type;   // "plant" | "explant" | "container"
hit.record_id;
hit.display_name;
hit.url;           // relative in-app path, e.g. "/dashboard/explants/<id>"
hit.contents;      // for a container: the cultures at that location

// POST /api/v1/label-scans — write:label_scans. Records that the scan happened.
await client.labels.recordScan({
  barcode: "XPL-2025-001",
  explant_id: hit.record_type === "explant" ? hit.record_id : undefined,
  context: "Growth room 2, shelf 3",
});
```

A code that matches nothing in the workspace raises an `XPlantError` with
status 404. Resolving leaves no trace; `recordScan()` is what records a visit.

### `client.devices`

```typescript
// POST /api/v1/devices — write:devices
const registered = await client.devices.register({
  name: "Growth Room 1 — Temp/Humidity",
  type: "sensor",          // sensor | controller | gateway
  hardware: "esp32",
  firmware_version: "1.2.0",
});

// GET /api/v1/devices — read:devices. Not paged.
const devices = await client.devices.list();
const one = await client.devices.get(registered.id); // filters the list; 404 if absent

// POST /api/v1/devices/{deviceId}/tokens — write:devices, workspace key only
const { token } = await client.devices.createToken(registered.id, { name: "shelf-3-pi" });

// GET /api/v1/devices/{deviceId}/tokens — read:devices. Prefixes and status, never secrets.
const tokens = await client.devices.listTokens(registered.id);

// POST /api/v1/devices/{deviceId}/heartbeat — device token, or write:devices
const { received_at } = await client.devices.heartbeat(registered.id);

// POST /api/v1/device-events — device token, or write:device_events
await client.devices.recordEvent({
  device_id: registered.id,
  event_type: "alert",     // heartbeat | alert | firmware_update | config_change | error | other
  payload: { message: "Humidity sensor not responding" },
});
```

A workspace that has connected every device its plan includes answers
`402 DEVICE_LIMIT_REACHED` on `register()`.

### `client.sensorReadings`

```typescript
// POST /api/v1/sensor-readings — device token, or write:sensor_readings
await device.sensorReadings.create({
  device_id: "device-uuid",
  type: "temperature",     // temperature | humidity | ph | co2 | light | other
  value: 24.5,
  unit: "C",               // 1–20 characters
});

// The same endpoint, up to 500 readings per request. Prefer this.
await device.sensorReadings.createBatch([
  {
    device_id: "device-uuid",
    type: "humidity",
    value: 71,
    unit: "%",
    recorded_at: "2026-09-25T12:00:00Z",
    external_id: "gw1-humidity-20260925T1200",  // dedupes a resent batch
  },
]);

// GET /api/v1/sensor-readings — read:sensor_readings (workspace key). Newest first.
const readings = await client.sensorReadings.list("device-uuid");
const recent = await client.sensorReadings.list({
  room_id: "room-uuid",
  type: "temperature",
  since: "2026-09-01T00:00:00Z",
  limit: 500,              // defaults to 100, capped at 1000; no offset
});
```

**Batch your posts.** One request per reading spends the rate limit many times
faster for the same data. Buffer locally and flush every 30–60 seconds, or once
500 readings are queued. Give every reading an `external_id` and a
`recorded_at`: a reading with the same device, `external_id` and `recorded_at`
as one already stored is dropped, so a batch resent after a network failure is
not stored twice.

### `client.equipment`

```typescript
// POST /api/v1/equipment/{id}/events — write:equipment_events
await client.equipment.recordEvent("autoclave-uuid", {
  kind: "calibration",         // calibration | service | fault | verification
  outcome: "pass",             // pass | fail | adjusted | inconclusive (default pass)
  result_summary: "121.1 °C held for 15 min",
});

// Or: this equipment was used on a record in your workspace
await client.equipment.recordEvent("hood-uuid", {
  kind: "used",
  subject_type: "sop_log",     // sop_log | media_batch | plant_transfer
                               // | explant_transfer | contamination_log
  subject_id: run.id,
});
```

---

## Paging

List endpoints page with `limit` and `offset`. `limit` defaults to 50 and is
capped at 200. The API returns no total, so a page shorter than `limit` is the
last one.

`paginate()` walks every page for you:

```typescript
import { paginate } from "@shmaplex/xplant-sdk";

for await (const plant of paginate((page) => client.plants.list(page))) {
  console.log(plant.name);
}

// Filters go alongside the page
const todo = paginate((page) => client.tasks.list({ status: "todo", ...page }));
for await (const task of todo) {
  if (task.priority === "urgent") break; // stops requesting pages
}
```

It works with `plants`, `explants`, `stages`, `transfers`, `events`, `tasks`,
`taskDemand` and `sops`. `pageSize` defaults to the 200-row maximum and is
capped there. Offsets are positions, not bookmarks: rows created while you
iterate can shift across a page boundary. For a stable feed of changes, use
`events.list({ since })`.

`devices.list()` does not page, and `sensorReadings.list()` takes a `limit`
(up to 1000) but no `offset` — narrow it with `since`.

---

## Errors

Every API failure throws an `XPlantError`:

```typescript
import { XPlantError } from "@shmaplex/xplant-sdk";

try {
  await client.tasks.create({ title: "Replate N2001" });
} catch (err) {
  if (err instanceof XPlantError) {
    err.status;     // HTTP status
    err.code;       // stable machine-readable code — branch on this
    err.message;    // readable, includes the API's error text; wording may change
    err.retryAfter; // seconds to wait, from Retry-After, or null
    err.body;       // the raw response text
  }
  throw err;
}
```

| Status | `code` | Meaning |
|---|---|---|
| 400, 422 | `VALIDATION_ERROR` | The request failed validation; the message names the field |
| 401 | `UNAUTHORIZED` | No key, an unknown or revoked key or device token, or the key's owner left the workspace |
| 402 | `PAID_PLAN_REQUIRED` | The API requires a paid workspace |
| 402 | `DEVICE_LIMIT_REACHED` | The workspace has connected every device its plan includes |
| 403 | `FORBIDDEN` | The key lacks the scope; the message names it |
| 403 | `DEVICE_TOKEN_NOT_ACCEPTED` | A device token was sent to an endpoint that needs a workspace key |
| 403 | `DEVICE_TOKEN_WRONG_DEVICE` | A device token tried to write about another device |
| 404 | `NOT_FOUND` | Not found — or in another workspace; the API does not distinguish |
| 409 | `IDEMPOTENCY_IN_FLIGHT` | A request with this `Idempotency-Key` is still running; retry shortly |
| 409 | `SOP_RUN_NOT_EFFECTIVE`, `SOP_RUN_CLOSED` | The SOP has no version in force; the run is complete |
| 409 | `DEVICE_INGEST_DISABLED` | A device in the batch is paused or retired |
| 429 | `RATE_LIMIT_EXCEEDED` | A rate limit is spent; wait `err.retryAfter` seconds |
| 500 | `*_FAILED` | The server could not complete the request |
| 503 | `DEVICE_LIMIT_UNAVAILABLE` | The device allowance could not be checked; nothing was registered |

`err.code` is `null` when a gateway answered instead of the API. A network
failure rejects with the error `fetch` raised, not an `XPlantError`.

**For the broad class of failure, branch on `status`.** 401 means fix the
credential, 403 means the credential is not allowed to do this. Some older
device and sensor routes do not yet use the standard code for every status —
for example, answering a validation failure with a `*_FAILED` code — so code
that must tell "bad key" from "missing scope" should read `status` first and
`code` for the specifics.

> **Note:** a task ordering change declined by the manual-override rule is a
> **success, not an error** — nothing throws. Check `result.skipped` on
> `tasks.update()`.

---

## Rate limits and retries

Every request counts against two per-minute budgets: **1,000 requests per API
key** and **3,000 per workspace** across all its keys. A device token has its
own budget, so one noisy device cannot spend the lab's. Sensor readings also
have a readings budget — 5,000 per key and 10,000 per workspace per five
minutes — because one request can carry 500 readings. Going over any of them
answers `429 RATE_LIMIT_EXCEEDED` with a `Retry-After` header, which the SDK
puts on `err.retryAfter`.

Retries are **off by default**. Turn them on per client:

```typescript
const client = new XPlantClient({
  apiKey: process.env.XPLANT_API_KEY,
  retry: true,  // or { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 60_000 }
});
```

With retry on:

- **`429`** and **`409 IDEMPOTENCY_IN_FLIGHT`** are retried on any method after
  waiting `Retry-After`. The API refused the request before doing any work, so
  resending cannot double a write. A `Retry-After` longer than `maxDelayMs` is
  not waited out; the error is thrown with `retryAfter` set, so you can
  reschedule.
- **Network errors and `502`/`503`/`504`** are retried with exponential
  backoff — for reads, and for writes to the endpoints that
  [replay an idempotency key](#idempotency). Other writes are never resent after
  a failure that does not prove they did not run.
- Nothing else is retried. `maxRetries` (default 2) caps the attempts after the
  first; an `AbortSignal` passed in the options cancels a wait in progress.

---

## Idempotency

Some writes accept an `Idempotency-Key` header: the API runs the write once per
key and answers a repeat with the stored result for 24 hours. A device on a
flaky link can then resend without recording the same thing twice.

These endpoints honour it:

| Endpoint | SDK method |
|---|---|
| `POST /api/v1/tasks` | `tasks.create` |
| `POST /api/v1/sop-runs` | `sopRuns.start` |
| `POST /api/v1/sop-runs/{id}/steps/{stepId}/events` | `sopRuns.recordStepEvent` |
| `POST /api/v1/sop-runs/{id}/steps/{stepId}/measurements` | `sopRuns.recordMeasurement` |
| `POST /api/v1/label-scans` | `labels.recordScan` |
| `POST /api/v1/equipment/{id}/events` | `equipment.recordEvent` |

Every other endpoint ignores the header. Sensor readings dedupe on
`external_id` and `recorded_at` instead — see
[`client.sensorReadings`](#clientsensorreadings).

Pass a key on any write:

```typescript
await client.tasks.create(
  { title: "Replate N2001 — second pass" },
  { idempotencyKey: "replate-N2001-pass-2" },
);
```

A key is 8–255 characters from `A-Z a-z 0-9 . _ : ~ -`, and is scoped to the
API key that sent it and to the endpoint, so two integrations cannot collide.
Reuse one only to mean "the same write again"; a malformed key is refused with
`422 VALIDATION_ERROR` rather than ignored. When `retry` is on and you pass none, the SDK generates one per
call and reuses it across that call's attempts.

---

## Device tokens

A device token is bound to one registered device. It can post that device's
sensor readings, events and heartbeat, and nothing else — it cannot read the
workspace, write about another device, or create tokens.

**1. Create the token once, from a setup machine, with a workspace key:**

```typescript
const admin = new XPlantClient({ apiKey: process.env.XPLANT_API_KEY });

const registered = await admin.devices.register({ name: "Shelf 3 Pi", type: "gateway" });
const { token } = await admin.devices.createToken(registered.id, { name: "shelf-3-pi" });
// Put `token` on the device now: it is shown only here and cannot be read back.
```

**2. On the device, use only the token:**

```typescript
const device = new XPlantClient({
  deviceToken: process.env.XPLANT_DEVICE_TOKEN, // xpd_live_…
  retry: true,
});

await device.devices.heartbeat(DEVICE_ID);
await device.sensorReadings.createBatch(readings);
await device.devices.recordEvent({ device_id: DEVICE_ID, event_type: "firmware_update" });
```

`deviceToken` only accepts an `xpd_` token: passing a workspace key there
throws at construction, so a key cannot end up on a device by mistake.

What a device token gets back when it steps outside its lane:

| Situation | Response |
|---|---|
| Any endpoint other than the four above | `403 DEVICE_TOKEN_NOT_ACCEPTED` |
| A reading, event or heartbeat for another device — even one reading in a batch | `403 DEVICE_TOKEN_WRONG_DEVICE` |
| An unknown or revoked token | `401 UNAUTHORIZED` |

`client.devices.listTokens(deviceId)` shows each token's prefix, status and last
use, so you can tell them apart. A `devices.revokeToken()` method will follow
when the API's revoke endpoint ships; until then, contact
[support@xplantpro.com](mailto:support@xplantpro.com) to revoke a token that
may be exposed. If a token is lost, create another.

---

## TypeScript

Full type definitions are included — no `@types/` package needed. Every
request and response shape is exported:

```typescript
import type {
  PlantSummary,
  ExplantSummary,
  TaskSummary,
  TaskCreateInput,
  TaskUpdateResult,
  SopDetail,
  SopRunDetail,
  SensorReadingPayload,
  DeviceTokenMinted,
  EquipmentEventInput,
  XPlantScope,
  XPlantErrorCode,
  WriteOptions,
} from "@shmaplex/xplant-sdk";
```

Response types only ever gain fields, and string unions of server-controlled
values (`XPlantErrorCode`, `XPlantScope`, `status` fields) accept values the SDK
has not seen yet — so a new code or scope does not break your build.

---

## Upgrading from 0.1.0

0.2.0 was never published, so upgrading from 0.1.0 takes in both releases. See
[CHANGELOG.md](CHANGELOG.md) for the full list. The changes that touch existing
code:

- **Resource methods return records, not the envelope.** Code that reached
  through `.data` (`(await client.plants.list()).data`) should drop that step.
- **The default host is `https://app.xplantpro.com`.** Clients that passed an
  explicit `baseUrl` are unaffected.
- **`tasks.update()` returns `{ task, priority_write, skipped }`**, not a bare
  task.
- **`sensorReadings.create()` sends `recorded_at`.** The old `timestamp` field
  is still accepted and mapped across, but was silently dropped before.
- **`SensorType` is `temperature | humidity | ph | co2 | light | other`.**
  `light_lux` and `ec` were never accepted.

Everything else is additive: new resources, device tokens, retries, idempotency
keys and `paginate()`.

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
