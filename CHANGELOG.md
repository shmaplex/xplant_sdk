# Changelog

All notable changes to `@shmaplex/xplant-sdk` will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This package uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on scope:** This package is published as `@shmaplex/xplant-sdk` while the
> `@xplant` npm org is being arranged. It will be re-published as `@xplant/sdk`
> once the scope is available, with a deprecation notice on this package.

---

## [Unreleased]

## [0.2.0] — 2026-08-06

Corrective release. Every change below fixes behaviour that never matched the
running API. Pre-1.0.

### Fixed
- **Default base URL** now points at `https://www.xplantpro.com`. It previously
  pointed at a host we do not serve, so every call from a default-constructed
  client failed. The same wrong domain has been removed from the thrown-error
  text and the README.
- **The response envelope is now unwrapped.** Every `/api/v1` route wraps its
  payload in `{ ok, data, error, code }`; the client returned that envelope while
  typing it as the payload, so `plants[0].name` was `undefined` with no type
  error. Resource methods now resolve to the records themselves.
- **A failure envelope is now raised, not returned.** `XPlantError` gained a
  `code` field carrying the stable machine-readable code, and its `message` now
  carries the API's `error` text — so a 403 names the missing scope. Non-JSON
  gateway responses and a 2xx body carrying `ok: false` both raise correctly.
- `sensorReadings.create()` sent `timestamp`, which the API ignores — back-dated
  readings were stored as "now". The field is now `recorded_at`; `timestamp` is
  deprecated but still mapped across, so existing firmware keeps working.
- `devices.get()` called a route that does not exist and always 404'd. It now
  resolves against the device list.
- Types hand-aligned against `lib/api/v1/serializers.ts`: `PlantSummary`
  (`workspace_id` is nullable for a solo workspace, `species` is always present,
  `created_at` is nullable), `SensorReading`, `DeviceSummary`, `DeviceEvent`,
  `HeartbeatResponse` (returns `received_at`), and `LabelResolveResult`
  (`record_type` is `plant | explant`; `url` is a relative in-app path).

### Added
- `tasks.create()` and `tasks.update()`, covering `priority`, `priority_rank`,
  `category`, `workflow_status`, `due_date`, `notes`, and `assigned_to`.
- **Manual-override reporting on task writes.** A write over this API counts as
  automatic and never overwrites an order somebody set by hand. When the API
  declines an ordering change it answers `200` with a report rather than an
  error. `tasks.update()` surfaces this as `TaskUpdateResult` —
  `{ task, priority_write, skipped }` — so a sync cannot silently appear to
  succeed. Send `release: true` to take a hand-ordered task back under automatic
  control.
- `TaskSummary` gained `priority`, `priority_rank`, `priority_source`, and
  `category`.
- Paging and filters: `plants.list({ limit, offset })`,
  `tasks.list({ limit, offset, status, assigned_to })`, and
  `sensorReadings.list({ device_id, room_id, type, since, limit })`.
- `devices.register()` and `devices.list()` — `register()` was documented in the
  README but had never been implemented.
- `client.requestEnvelope()` — escape hatch returning the full envelope for
  callers that need `meta`.
- `DEFAULT_BASE_URL` is exported.
- New types: `PageParams`, `TaskCreateInput`, `TaskUpdateInput`,
  `TaskListParams`, `TaskUpdateResult`, `PriorityWriteReport`, `PrioritySource`,
  `TaskPriority`, `TaskWorkflowStatus`, `TaskCategory`, `DeviceType`,
  `DeviceRegisterPayload`, `DeviceEventType`, `SensorReadingListParams`.

### Changed
- **Breaking at the value level:** resource methods return records rather than
  the `{ ok, data }` envelope. The previous typings never matched runtime, so no
  correct code depended on the old shape — but code that worked around the bug by
  reaching through `.data` must drop that step.
- **Breaking:** `tasks.update()` returns `TaskUpdateResult`, not `TaskSummary`.
  The task is at `result.task`. This is a new method, so no existing code breaks.
- Resources now receive an `EnvelopeRequestFn` instead of a `RequestFn`. This
  affects only code constructing a resource class directly. `RequestFn` is still
  exported, deprecated.
- `SensorType` now matches the values the API accepts
  (`temperature | humidity | ph | co2 | light | other`). `light_lux` and `ec`
  were never valid and returned 422.
- `devices.heartbeat()` still accepts a metadata argument for compatibility, but
  it is documented as ignored — the endpoint reads no request body.

## [0.1.0] — 2026-06-09

### Added
- `XPlantClient` — main entry point with API key auth and base URL override
- `XPlantError` — typed error class with `status` and `body` fields
- `SensorReadingsResource` — `create()` and `list()` for environmental sensor data
- `DevicesResource` — `heartbeat()`, `register()`, and `get()` for device management
- `PlantsResource` — `list()` and `get()` for plant record reads
- `TasksResource` — `list()` for due task reads
- `LabelsResource` — `resolve()` for QR/barcode label lookup
- Full TypeScript types: `SensorReading`, `DeviceEvent`, `PlantSummary`, `TaskSummary`, `LabelResolveResult`
- Dual CJS + ESM build via `tsup`
- CI workflow (Node 18/20/22)
- Automated npm publish on semver tag
