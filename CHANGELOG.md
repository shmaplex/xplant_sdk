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

### Fixed
- **Default `baseUrl` pointed at a host we don't serve.** Was `https://xplant.shmaplex.com`; now `https://www.xplantpro.com`, matching production. Also corrected in the constructor's error message and the README.
- **`request()` did not unwrap the API's response envelope.** Every `/api/v1` route returns `{ ok, data, error, code }`; the client previously returned that whole envelope typed as the resource shape, so e.g. `client.plants.list()` resolved to `{ ok: true, data: [...] }` rather than the array itself. `request()` now unwraps `data` on success and throws `XPlantError` — with `error`/`code` from the envelope — on failure. Affects every resource, including the already-shipped `devices` and `sensorReadings`.

### Added
- `TasksResource#create()` and `TasksResource#update()` — `POST` and `PATCH /api/v1/tasks`, accepting `priority` and `assigned_to` so an external system can drive the bench queue from its own data.
- `TaskCreatePayload`, `TaskUpdatePayload`, `TaskPriority`, `TaskCategory`, and `WorkflowStatus` types.
- `XPlantError.code` — the stable, machine-readable error code from the response envelope, alongside the existing `status` and `body`.

### Changed
- **Breaking:** `TaskSummary` now includes `priority` and `category`, and `due_date`/`assigned_to`/`created_at` are `string | null` (previously optional/non-null) to match what the endpoint actually returns.
- **Breaking:** `PlantSummary.species` is now required (was optional) and `workspace_id`/`created_at` are `string | null` (previously non-null), matching the server contract. A solo workspace with no team returns `workspace_id: null`.
- **Breaking:** `LabelResolveResult.record_type` narrowed from an open string union to `"plant" | "explant"` — the only two values the endpoint returns.

Every type change above brings the SDK in line with `lib/api/v1/serializers.ts` in the `shmaplex/xplant` app repo, which is the contract of record. Nothing correct depended on the old shapes — the previous types never matched the runtime response.

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
