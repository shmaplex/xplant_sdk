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

**Documentation:** the guides and endpoint reference for the xPlant API live at
[**docs.xplantpro.com**](https://docs.xplantpro.com/docs). They cover the
[quickstart](https://docs.xplantpro.com/docs/quickstart),
[authentication and plans](https://docs.xplantpro.com/docs/authentication),
[scopes](https://docs.xplantpro.com/docs/scopes),
[errors](https://docs.xplantpro.com/docs/errors), and
[every endpoint](https://docs.xplantpro.com/docs/api) with its request and
response. This README covers the JavaScript/TypeScript SDK. Hardware examples
live in the [xplant_os](https://github.com/shmaplex/xplant_os) repository.

---

## Contents

- [Installation](#installation)
- [Plans and access](#plans-and-access)
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

Requires **Node.js 18+**, or any runtime with a standard `fetch` — Deno, Bun,
and edge or serverless functions.

> **Call the API from your server, not a web page.** A key in browser code can
> be read by anyone who loads the page, and the API does not accept requests
> from browsers.

---

## Plans and access

> Full guide: [Authentication and plans](https://docs.xplantpro.com/docs/authentication#plans-and-access)

**Your key can never do more than you can in xPlant.** It unlocks what your
plan includes, and what your role allows.

| Plan | What API keys can do |
|---|---|
| **xPlant+ Teams** and **Enterprise** | The full API: every scope |
| **xPlant+ Hobby** and **xPlant+ Pro Lab** | Connect devices only: `read:devices`, `write:devices`, `write:sensor_readings`, `write:device_events` |
| **Free** | No API access |

See [plans](https://www.xplantpro.com/en/subscriptions) to upgrade.

What decides what a key can do:

- **Scopes.** You pick them when you create the key. Give each integration only
  the scopes it needs, and a separate key per integration, so one can be
  revoked without touching the others. A key can't be created with scopes your
  role or plan doesn't allow; the refusal names them.
- **Your role in the workspace.** Every request is checked against the key
  owner's *current* role, so a key loses access the moment its owner is
  demoted:
  - reads need any active member
  - writes need `member` or above
  - `read:pricing`, `read:commerce` and `write:demand` need `manager` or above
- **Your plan.** Beyond the tiers above, some features have their own plan
  gate, such as culture line pricing and equipment calibration history. The
  plan's allowances still apply too: the number of devices you can connect at
  once, and record limits. See the [plans page](https://www.xplantpro.com/en/subscriptions).
- **One workspace.** A key acts only in the workspace it was created in, and
  only while its owner is still a member there.

`client.me.get()` returns `effectiveScopes` — what the key can use right now,
after all of that — plus the owner's `role` and the workspace's `apiAccess`
(`"full"` or `"devices"`), so an integration can check before it starts.

| Status | Means |
|---|---|
| `402` | The **plan** doesn't include this (`PAID_PLAN_REQUIRED`, `FEATURE_NOT_INCLUDED`, `PLAN_LIMIT_REACHED`, `DEVICE_LIMIT_REACHED`) |
| `403` | The **key or its owner** can't do this: a missing scope, or a role that isn't allowed. The message names which. |

Device tokens keep posting readings, events and heartbeats if a plan lapses, so
a grow room never goes dark. New devices and tokens follow the plan.

**Enterprise** can scope organisation-specific integrations and API
requirements. Contact [support@xplantpro.com](mailto:support@xplantpro.com).

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
  title: "Subculture B-2026-114 — second pass",
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
  timeout: 60_000,                      // ms per attempt (the default); 0 waits indefinitely
  fetch: customFetch,                   // optional; e.g. to log or trace requests
});
```

Every method also takes a final options object: `{ signal, timeout }` for reads,
and `{ signal, timeout, idempotencyKey }` for writes.

---

## Authentication and scopes

> Full guide: [Scopes](https://docs.xplantpro.com/docs/scopes)

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
| `write:plants` | Create and update plant records | `plants.create`, `plants.update` |
| `read:explants` | Read explant records | `explants.list`, `explants.get`, `explants.findByExternalId` |
| `write:explants` | Create and update explant records | `explants.create`, `explants.update` |
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
| `write:devices` | Register devices, send heartbeats, create and revoke device tokens | `devices.register`, `devices.heartbeat`, `devices.createToken`, `devices.revokeToken` |
| `write:device_events` | Record device events | `devices.recordEvent` |
| `read:sensor_readings` | Query sensor readings | `sensorReadings.list` |
| `write:sensor_readings` | Submit sensor readings | `sensorReadings.create`, `sensorReadings.createBatch` |
| `write:equipment_events` | Record equipment use and maintenance | `equipment.recordEvent` |
| `read:equipment` | Read the equipment library and its history | `equipment.list`, `equipment.get`, `equipment.listEvents` |
| `read:contaminations` | Read contamination logs | `contaminations.list`, `contaminations.get` |
| `write:contaminations` | Log contaminations | `contaminations.create` |
| `read:comments` | Read comments on records | `comments.list` |
| `write:comments` | Add comments to records | `comments.create` |
| `read:assets` | Read photos and media on records | `assets.list`, `assets.get` |
| `write:assets` | Attach photos and media | `assets.create` |
| `read:media_recipes` | Read media recipes | `mediaRecipes.list`, `mediaRecipes.get` |
| `write:media_recipes` | Create and update media recipes | `mediaRecipes.create`, `mediaRecipes.update` |
| `read:pricing` | Culture line pricing (manager role) | `pricing.listCultureLines`, `pricing.listEvents` |
| `read:commerce` | Store order lines and sell-through (manager role) | `commerce.listOrderLines`, `commerce.getSellThrough` |

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
envelope.requestId; // the API's id for this request, from X-Request-Id
```

---

## Resources

> Every endpoint, with its request and response: [API reference](https://docs.xplantpro.com/docs/api)

Each heading gives the endpoint and the scope it needs. The examples assume a
`client` built with a workspace key, or a `device` built with a device token.

### `client.me` — who am I

```typescript
// GET /api/v1/me — no scope needed
const me = await client.me.get();
me.key;             // { id, name, prefix, environment, status, lastUsedAt, createdAt }
me.scopes;          // every scope the key was created with
me.effectiveScopes; // what it can use right now, after the owner's role and the plan
me.role;            // owner | admin | manager | member | viewer | guest
me.apiAccess;       // "full" (Teams, Enterprise) or "devices" (Hobby, Pro Lab)
me.workspace;       // { id }
me.user;            // { id }

if (!me.effectiveScopes.includes("write:tasks")) {
  throw new Error(`This key can't create tasks (role: ${me.role}, API access: ${me.apiAccess})`);
}
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
// GET /api/v1/plants — read:plants. Newest first.
const firstPage = await client.plants.list({ limit: 50 });   // one page

for await (const plant of client.plants.list()) {            // every plant
  console.log(plant.name);
}

// GET /api/v1/plants/{id}
const plant = await client.plants.get("plant-uuid");

// Resolve your own identifier (e.g. "LINE-0412") — resolves to the plant or null
const match = await client.plants.findByExternalId("LINE-0412");

// POST /api/v1/plants — write:plants. Safe to retry with an Idempotency-Key.
const { plant, warning } = await client.plants.create({
  species: "Alocasia zebrina",
  external_id: "LINE-0412",       // an id already in use answers 409 DUPLICATE_ENTRY
  initial_stage: "Mother Block",
  custom_fields: { tray: "B4" },  // the lab's own fields, as set up in settings
});
// `warning` is set only if the plant saved but its first stage didn't

// PATCH /api/v1/plants/{id} — write:plants. Only the fields you send change.
await client.plants.update(plant.id, { status: "in_culture" });
```

Every plant and explant carries `custom_fields`: the lab's own fields, keyed as
set up in the lab's settings. Editing a teammate's record needs its creator or
a manager (`403 PLANT_WRITE_FORBIDDEN` / `EXPLANT_WRITE_FORBIDDEN`), and a
workspace at its plan's record limit answers `402 PLAN_LIMIT_REACHED`.

### `client.explants`

```typescript
// GET /api/v1/explants — read:explants. Newest first.
for await (const batch of client.explants.list()) {
  console.log(batch.external_id, batch.current_count);
}

// GET /api/v1/explants/{id}
const batch = await client.explants.get("explant-uuid");

// Resolve your own batch identifier — resolves to the batch or null
const match = await client.explants.findByExternalId("LINE-0412");

// POST /api/v1/explants — write:explants. Safe to retry with an Idempotency-Key.
const created = await client.explants.create({
  label: "B-2026-114",
  plant_id: "plant-uuid",
  external_id: "B-2026-114",
});

// PATCH /api/v1/explants/{id} — write:explants
await client.explants.update(created.id, { status: "needs_subculture" });
```

### `client.stages`

Pass exactly one of `plant_id` or `explant_id`.

```typescript
// GET /api/v1/stages — read:transfers. Most recent first.
const history = await client.stages.list({ explant_id: "explant-uuid" });

// POST /api/v1/stages — write:transfers. Completes the current stage and starts the new one.
// `stage` must be in the lab's stage list; the result carries its key ("Rooting" → "rooting").
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
  status: "completed",   // completed (the default) | pending, for a planned transfer
  // transfer_cycle continues from the last recorded cycle unless you set it
});
```

Every transfer and stage move also appears in `events.list()`, as `transfer`
and `stage_change` events, so one delta feed covers them.

### `client.events` — change history

```typescript
// GET /api/v1/events — read:events. Oldest first. `entity` is required.
for await (const event of client.events.list({ entity: "explant" })) {
  console.log(event.event_type, event.entity_id);
}
```

Plant and explant history are paged separately — call once per entity type.

**Pulling only what's new.** Save the newest `created_at` you received. On the
next run, start from a little before it — a minute is plenty — and store events
keyed by `id`, so reading that overlap twice is harmless. Events written
together share a timestamp, and one that commits late can carry an earlier
timestamp than one you have already read; the overlap catches both.

```typescript
// `newest` is the created_at saved by the previous run
const since = new Date(Date.parse(newest) - 60_000).toISOString();
for await (const event of client.events.list({ entity: "explant", since })) {
  await store.upsert(event.id, event);
  if (event.created_at > newest) newest = event.created_at;
}
```

### `client.tasks`

```typescript
// GET /api/v1/tasks — read:tasks. Soonest due first.
const todo = await client.tasks.list({ status: "todo", limit: 50 });
const mine = await client.tasks.list({ assigned_to: userId });

// GET /api/v1/tasks/{id} — includes entity_link, the plant or explant it is about
const task = await client.tasks.get("task-uuid");

// POST /api/v1/tasks — write:tasks
const created = await client.tasks.create({
  title: "Subculture B-2026-114 — second pass",
  category: "transfer",        // media_prep | transfer | contamination | subculture
                               // | sop_review | acclimation | cleaning | monitoring | other
  priority: "high",            // low | medium | high | urgent
  workflow_status: "todo",     // backlog | todo | in_progress | waiting_blocked | review | done
  due_date: "2026-10-01T09:00:00+09:00", // ISO 8601 with an offset
  is_all_day: false,
  assigned_to: userId,         // must be an active member of the key's workspace
  genus: "Alocasia",
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
const signals = await client.taskDemand.list({ genus: "Alocasia" });

// Just the current reading for one genus
const [current] = await client.taskDemand.list({ genus: "Alocasia", current: true });

// POST /api/v1/tasks/demand — write:demand, kept separate from write:tasks so a
// demand-only integration doesn't also get task writes
await client.taskDemand.record({
  genus: "Alocasia",
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
const run = await client.sopRuns.start({ sop_id: "sop-uuid", batch_code: "B-2026-114" });

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
`409 SOP_RUN_NOT_EFFECTIVE`. A run that has ended (completed, failed,
cancelled or archived) answers `409 SOP_RUN_CLOSED`, and a step that isn't in
the version the run follows answers `404 NOT_FOUND`.

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

// GET /api/v1/devices — read:devices. 200 per page; iterate for every device.
for await (const device of client.devices.list()) {
  console.log(device.name, device.status, device.last_seen_at);
}
const one = await client.devices.get(registered.id); // searches every page; 404 if absent

// POST /api/v1/devices/{deviceId}/tokens — write:devices, workspace key only
const { token } = await client.devices.createToken(registered.id, { name: "shelf-3-pi" });

// GET /api/v1/devices/{deviceId}/tokens — read:devices. Prefixes and status, never secrets.
const tokens = await client.devices.listTokens(registered.id);

// DELETE /api/v1/devices/{deviceId}/tokens/{tokenId} — write:devices, workspace key only.
// Refused from the token's next request; revoking twice is not an error.
const revoked = await client.devices.revokeToken(registered.id, tokens[0].id);

// POST /api/v1/devices/{deviceId}/heartbeat — device token, or write:devices
const { received_at } = await client.devices.heartbeat(registered.id);

// POST /api/v1/device-events — device token, or write:device_events
await client.devices.recordEvent({
  device_id: registered.id,
  event_type: "alert",     // heartbeat | alert | firmware_update | config_change | error | other
  payload: { message: "Humidity sensor not responding" },
  external_id: "shelf-3-alert-0142", // optional: a retried event is stored once
});
```

A workspace that has connected every device its plan includes answers
`402 DEVICE_LIMIT_REACHED` on `register()`, and so does one whose plan includes
no devices.

### `client.sensorReadings`

```typescript
// POST /api/v1/sensor-readings — device token, or write:sensor_readings.
// Resolves with the stored reading — or, for a duplicate, the reading already stored.
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
const latest = await client.sensorReadings.list("device-uuid"); // one page

// Every reading in a window — since and until are both inclusive
for await (const r of client.sensorReadings.list({
  room_id: "room-uuid",
  type: "temperature",
  since: "2026-09-01T00:00:00Z",
  until: "2026-09-30T23:59:59Z",
  limit: 1000,             // page size: defaults to 100, capped at 1000
})) {
  console.log(r.recorded_at, r.value, r.unit);
}
```

**Batch your posts.** One request per reading spends the rate limit many times
faster for the same data. Give every reading an `external_id` and a
`recorded_at`: a reading with the same device, `external_id` and `recorded_at`
as one already stored is dropped, so a batch resent after a network failure is
not stored twice.

`sensorReadings.buffer()` does all of that for you on a device:

```typescript
const buffer = device.sensorReadings.buffer({
  flushIntervalMs: 30_000,   // send at least this often (the default)
  maxBatch: 500,             // or as soon as this many are waiting (the default)
  onError: (err, { pending, dropped }) => console.warn(err, { pending, dropped }),
});

setInterval(() => {
  buffer.add({ device_id: DEVICE_ID, type: "temperature", value: readProbe(), unit: "C" });
}, 60_000);

// Before the process exits — anything still queued is lost otherwise
process.on("SIGTERM", () => buffer.close().finally(() => process.exit(0)));
```

- Each reading is stamped with `recorded_at` when you add it, and an
  `external_id` unless it has one, so a resent batch is stored once.
- When a send fails, the readings stay queued in order and go out with the
  next send. Up to `maxBuffered` (10 000) are held; past that the oldest are
  dropped and reported to `onError`.
- A reading the API rejects as invalid is dropped and reported, without
  holding up the rest of its batch.
- The queue lives in memory. Readings still queued when the process dies are
  lost, so call `close()` on shutdown.

### `client.equipment`

```typescript
// GET /api/v1/equipment — read:equipment
for await (const item of client.equipment.list({ status: "active" })) {
  console.log(item.name, item.category, item.next_calibration_due_at);
}

// GET /api/v1/equipment/{id}
const autoclave = await client.equipment.get("autoclave-uuid");

// GET /api/v1/equipment/{id}/events — its history. Calibration and maintenance
// history needs a plan that includes it (402 FEATURE_NOT_INCLUDED otherwise).
for await (const entry of client.equipment.listEvents(autoclave.id, { kind: "calibration" })) {
  console.log(entry.occurred_at, entry.outcome, entry.certificate_number);
}

// POST /api/v1/equipment/{id}/events — write:equipment_events
await client.equipment.recordEvent(autoclave.id, {
  kind: "calibration",         // calibration | preventive_maintenance
  outcome: "pass",             // pass | pass_after_adjustment | out_of_tolerance | fail | not_performed
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

### `client.contaminations`

```typescript
// GET /api/v1/contaminations — read:contaminations. Newest first.
for await (const c of client.contaminations.list({ status: "active", explant_id: "explant-uuid" })) {
  console.log(c.issue, c.severity, c.vessels_affected);
}

// GET /api/v1/contaminations/{id}
const log = await client.contaminations.get("contamination-uuid");

// POST /api/v1/contaminations — write:contaminations. Safe to retry with an Idempotency-Key.
await client.contaminations.create({
  explant_id: "explant-uuid",
  type: "fungal",              // mold | bacteria | fungal | yeast | viral | … | other
  issue: "White fuzz at the media line",
  severity: "high",            // very low | low | medium | high | critical
  suspected_source: "airborne",
  vessels_affected: 3,
});
```

### `client.comments`

```typescript
// GET /api/v1/comments — read:comments. The comments on one record.
for await (const c of client.comments.list({ entity_type: "explant", entity_id: "explant-uuid" })) {
  console.log(c.author.name, c.body);
}

// POST /api/v1/comments — write:comments. Safe to retry with an Idempotency-Key.
await client.comments.create({
  entity_type: "explant",      // plant | explant | contamination | task | media_recipe | sop
  entity_id: "explant-uuid",
  body: "Moved to shelf 3 after the second transfer.",
  // parent_id: "comment-uuid",  — reply to a comment
});
```

A body containing a signed link that will expire is refused with 422. Link to
the record instead.

### `client.assets` — photos and media

```typescript
// GET /api/v1/assets — read:assets. The assets on one record.
for await (const photo of client.assets.list({ target: "explant", target_id: "explant-uuid" })) {
  console.log(photo.caption, photo.view_url);
}

// GET /api/v1/assets/{id} — with a fresh view_url
const photo = await client.assets.get("asset-uuid");

// POST /api/v1/assets — write:assets. From a URL the API fetches…
await client.assets.create({
  target: "explant",           // plant | explant | contamination | sop
  target_id: "explant-uuid",
  image_url: "https://example.com/photos/jar-12.jpg",
  caption: "Week 3, jar 12",
});
// …or as base64: { target, target_id, image_base64, filename }
```

`view_url` works for about 15 minutes (`view_url_expires_at`). Fetch the asset
again for a fresh link, and never store one. A file that is too large answers
`413 PAYLOAD_TOO_LARGE`, an unsupported type `415 UNSUPPORTED_MEDIA_TYPE`, and
an image URL that couldn't be fetched `422 IMAGE_URL_FETCH_FAILED`.

### `client.mediaRecipes`

```typescript
// GET /api/v1/media-recipes — read:media_recipes
for await (const recipe of client.mediaRecipes.list({ status: "active" })) {
  console.log(recipe.title, recipe.ph_target, recipe.components.length);
}

// GET /api/v1/media-recipes/{id}
const recipe = await client.mediaRecipes.get("recipe-uuid");

// POST /api/v1/media-recipes — write:media_recipes. Safe to retry with an Idempotency-Key.
const created = await client.mediaRecipes.create({
  title: "MS + 2 mg/L BAP",
  components: [
    { name: "MS basal salts", qty: "4.4", unit: "g/L" },
    { name: "Sucrose", qty: "30", unit: "g/L" },
    { name: "BAP", qty: "2", unit: "mg/L" },
  ],
  ph_target: 5.7,
  visibility: "team",
});

// PATCH /api/v1/media-recipes/{id} — only the recipe's author can edit it
await client.mediaRecipes.update(created.id, { status: "archived" });
```

### `client.pricing` — culture line pricing

Pricing needs the `read:pricing` scope, a key owner who is a `manager` or
above, and a plan that includes pricing (`402 FEATURE_NOT_INCLUDED` otherwise).

```typescript
// GET /api/v1/pricing/culture-lines — the current price per culture line
for await (const price of client.pricing.listCultureLines()) {
  console.log(price.plant_id, price.list_price.amount, price.list_price.currency);
}

// GET /api/v1/pricing/events — list-price changes over time
for await (const change of client.pricing.listEvents({ plant_id: "plant-uuid" })) {
  console.log(change.changed_at, change.previous_list_price?.amount, "→", change.list_price.amount);
}
```

Amounts are exact decimals written as text (`"1250.00"`), so parse them with a
decimal type, not `Number()`, when the value matters.

### `client.commerce` — store orders and sell-through

The same requirements as pricing apply: `read:commerce`, `manager` or above, and
a plan that includes pricing.

```typescript
// GET /api/v1/commerce/order-lines — order lines read from a connected store
for await (const line of client.commerce.listOrderLines({ from: "2026-09-01T00:00:00Z" })) {
  console.log(line.plant_id, line.quantity, line.unit_price?.amount);
}

// GET /api/v1/commerce/sell-through — units and revenue per culture line
const rows = await client.commerce.getSellThrough({ from: "2026-07-01T00:00:00Z" });
for (const row of rows) {
  console.log(row.plant_id, row.units, row.revenue.amount, row.currency);
}
```

Sell-through has one row per culture line **and currency**. Revenue is never
added up across currencies.

---

## Paging

> Full guide: [Pagination](https://docs.xplantpro.com/docs/pagination)

Every list method that pages returns a `ListPromise`. Await it for one page, or
iterate it for everything:

```typescript
// One page (50 rows by default, up to 200)
const firstPage = await client.plants.list({ limit: 200 });

// Every row — the SDK fetches pages as the loop reaches them
for await (const task of client.tasks.list({ status: "todo" })) {
  if (task.priority === "urgent") break; // stops requesting pages
}

// Whole pages, e.g. to write each one to your database in a single statement
for await (const page of client.explants.list({ limit: 200 }).pages()) {
  await db.upsertMany(page.data);
}
```

Every list method works this way: `plants`, `explants`, `stages`,
`transfers`, `events`, `tasks`, `taskDemand`, `sops`, `devices`,
`devices.listTokens`, `sensorReadings`, `contaminations`, `comments`, `assets`,
`mediaRecipes`, `equipment`, `equipment.listEvents`, `pricing` and `commerce`.
`limit` sets the page size. It defaults to 50 and is capped at 200, except for
devices and device tokens (200 by default) and sensor readings (100 by default,
up to 1000).

**Cursors.** Every list pages by cursor, which stays correct while rows are
being added: nothing is skipped or seen twice. The SDK follows the cursor for
you. Each page from `.pages()` also carries a `nextCursor`, which you can save
and pass back as `cursor` to resume later — in another run, say:

```typescript
let cursor = await loadCheckpoint(); // undefined on the first run
for await (const page of client.plants.list({ limit: 200, cursor }).pages()) {
  await db.upsertMany(page.data);
  if (page.nextCursor) await saveCheckpoint(page.nextCursor);
}
```

A cursor is opaque: store it, don't parse it. Use it with the same filters it
came from. One the API no longer accepts answers `422 INVALID_CURSOR` — start
again from the first page.

`offset` still works for `limit`/`offset` paging, but offsets are positions,
not bookmarks: rows added between requests can shift across a page boundary.
Prefer iterating, or saved cursors.

---

## Errors

> Full guide: [Errors](https://docs.xplantpro.com/docs/errors)

Every API failure throws an `XPlantError`:

```typescript
import {
  XPlantConnectionError,
  XPlantError,
  XPlantTimeoutError,
} from "@shmaplex/xplant-sdk";

try {
  await client.tasks.create({ title: "Subculture B-2026-114" });
} catch (err) {
  if (err instanceof XPlantError) {
    err.status;     // HTTP status
    err.code;       // stable machine-readable code — branch on this
    err.message;    // readable, includes the API's error text; wording may change
    err.retryAfter; // seconds to wait, from Retry-After, or null
    err.requestId;  // the API's id for this request — quote it to support
    err.body;       // the raw response text
  } else if (err instanceof XPlantTimeoutError) {
    err.timeout;    // no answer within this many ms
  } else if (err instanceof XPlantConnectionError) {
    err.cause;      // the network error fetch raised
  }
  throw err;
}
```

`XPlantError` means the API answered with a failure. `XPlantConnectionError`
means it never answered — DNS, TLS, a dropped connection — and its subclass
`XPlantTimeoutError` means an attempt ran past `timeout`. Aborting through your
own `signal` rejects with the signal's reason instead.

| Status | `code` | Meaning |
|---|---|---|
| 400, 422 | `VALIDATION_ERROR` | The request failed validation; the message names the field |
| 401 | `UNAUTHORIZED` | No key, an unknown or revoked key or device token, or the key's owner left the workspace |
| 402 | `PAID_PLAN_REQUIRED` | The plan doesn't include this part of the API — see [Plans and access](#plans-and-access) |
| 402 | `FEATURE_NOT_INCLUDED` | The plan doesn't include this feature (e.g. pricing, calibration history) |
| 402 | `PLAN_LIMIT_REACHED` | The workspace has reached a record limit its plan sets |
| 402 | `DEVICE_LIMIT_REACHED` | The workspace has connected every device its plan includes |
| 403 | `FORBIDDEN` | The key lacks the scope, or its owner's role can't use it; the message names which |
| 403 | `PLANT_WRITE_FORBIDDEN`, `EXPLANT_WRITE_FORBIDDEN` | Editing a teammate's record needs its creator or a manager |
| 403 | `MEDIA_RECIPE_NOT_OWNER` | Only a recipe's author can edit it |
| 403 | `DEVICE_TOKEN_NOT_ACCEPTED` | A device token was sent to an endpoint that needs a workspace key |
| 403 | `DEVICE_TOKEN_WRONG_DEVICE` | A device token tried to write about another device |
| 404 | `NOT_FOUND` | Not found, in another workspace, or a malformed id; the API does not distinguish |
| 409 | `IDEMPOTENCY_IN_FLIGHT` | A request with this `Idempotency-Key` is still running; retry shortly |
| 422 | `INVALID_CURSOR` | The cursor is malformed, from another endpoint, or used with other filters; start from the first page |
| 409 | `SOP_RUN_NOT_EFFECTIVE`, `SOP_RUN_CLOSED` | The SOP has no version in force; the run has ended |
| 409 | `DEVICE_INGEST_DISABLED` | A device in the batch is paused or retired |
| 409 | `DUPLICATE_ENTRY` | The `external_id` is already in use |
| 413 | `PAYLOAD_TOO_LARGE` | The uploaded file is too large |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | The uploaded file's type isn't supported |
| 422 | `IMAGE_URL_FETCH_FAILED` | The image at `image_url` couldn't be fetched |
| 429 | `RATE_LIMIT_EXCEEDED` | A rate limit is spent; wait `err.retryAfter` seconds |
| 500 | `*_FAILED` | The server could not complete the request |
| 503 | `DEVICE_LIMIT_UNAVAILABLE` | The device allowance could not be checked; nothing was registered |

`err.code` is `null` when a gateway answered instead of the API.

**For the broad class of failure, branch on `status`; use `code` for the
specifics.** 401 means fix the credential, 402 means the plan does not include
it, and 403 means the credential is not allowed to do this. Codes can be added
over time, and the status class is the part that never changes meaning.

> **Note:** a task ordering change declined by the manual-override rule is a
> **success, not an error** — nothing throws. Check `result.skipped` on
> `tasks.update()`.

---

## Rate limits and retries

> Full guide: [Rate limits](https://docs.xplantpro.com/docs/rate-limits)

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

**Timeouts.** Each attempt may take 60 seconds, including reading the response,
before it is abandoned with `XPlantTimeoutError`. Set `timeout` on the client or
on one call; `0` waits indefinitely. With retry on, a timed-out read is retried
like any other network failure.

---

## Idempotency

> Full guide: [Idempotency](https://docs.xplantpro.com/docs/idempotency)

Some writes accept an `Idempotency-Key` header: the API runs the write once per
key and answers a repeat with the stored result for 24 hours. A device on a
flaky link can then resend without recording the same thing twice.

These endpoints honour it:

| Endpoint | SDK method |
|---|---|
| `POST /api/v1/tasks` | `tasks.create` |
| `POST /api/v1/tasks/demand` | `taskDemand.record` |
| `POST /api/v1/stages` | `stages.advance` |
| `POST /api/v1/transfers` | `transfers.create` |
| `POST /api/v1/devices` | `devices.register` |
| `POST /api/v1/plants` | `plants.create` |
| `POST /api/v1/explants` | `explants.create` |
| `POST /api/v1/contaminations` | `contaminations.create` |
| `POST /api/v1/comments` | `comments.create` |
| `POST /api/v1/assets` | `assets.create` |
| `POST /api/v1/media-recipes` | `mediaRecipes.create` |
| `POST /api/v1/sop-runs` | `sopRuns.start` |
| `POST /api/v1/sop-runs/{id}/steps/{stepId}/events` | `sopRuns.recordStepEvent` |
| `POST /api/v1/sop-runs/{id}/steps/{stepId}/measurements` | `sopRuns.recordMeasurement` |
| `POST /api/v1/label-scans` | `labels.recordScan` |
| `POST /api/v1/equipment/{id}/events` | `equipment.recordEvent` |

Every other endpoint ignores the header. Two dedupe on your own id instead:
- sensor readings on `external_id` and `recorded_at` — see
  [`client.sensorReadings`](#clientsensorreadings);
- device events on `external_id`.

A repeat resolves with the record already stored, and nothing new is written.

Pass a key on any write:

```typescript
await client.tasks.create(
  { title: "Subculture B-2026-114 — second pass" },
  { idempotencyKey: "subculture-b-2026-114-pass-2" },
);
```

A key is 8–255 characters from `A-Z a-z 0-9 . _ : ~ -`, and is scoped to the
API key that sent it and to the endpoint, so two integrations cannot collide.
Reuse one only to mean "the same write again"; a malformed key is refused with
`422 VALIDATION_ERROR` rather than ignored. When `retry` is on and you pass none, the SDK generates one per
call and reuses it across that call's attempts.

---

## Device tokens

> Full guide: [Device tokens](https://docs.xplantpro.com/docs/device-tokens) · [Sensors and devices](https://docs.xplantpro.com/docs/guides/sensors-and-devices)

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
await device.devices.recordEvent({ device_id: DEVICE_ID, event_type: "firmware_update" });

// Readings: queue them and let the buffer batch, send and resend
const buffer = device.sensorReadings.buffer();
buffer.add({ device_id: DEVICE_ID, type: "humidity", value: 71, unit: "%" });
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
use, so you can tell them apart. `client.devices.revokeToken(deviceId, tokenId)`
revokes one: it is refused from its very next request.

**Taking a device out of service in xPlant revokes all of its tokens at once;
deleting the device removes them.** If a token is lost or may be exposed,
revoke it and create another.

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
  ListPage,
  SensorBufferOptions,
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

- **List methods return a `ListPromise`.** Awaiting one still gives you the
  first page as an array, so existing code keeps working; iterating it gives
  you every page.
- **A network failure throws `XPlantConnectionError`** (or `XPlantTimeoutError`)
  instead of the raw `fetch` error, which is on `err.cause`. Requests now time
  out after 60 seconds by default.

Everything else is additive: new resources, device tokens, retries,
idempotency keys, cursors and the sensor buffer.

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
