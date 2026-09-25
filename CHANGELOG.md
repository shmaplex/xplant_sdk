# Changelog

All notable changes to `@shmaplex/xplant-sdk` will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This package uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on scope:** This package is published as `@shmaplex/xplant-sdk` while the
> `@xplant` npm org is being arranged. It will be re-published as `@xplant/sdk`
> once the scope is available, with a deprecation notice on this package.

---

## [Unreleased]

## [0.5.0] — 2026-09-25

The rest of the `/api/v1` surface: all 58 endpoints now have a method.

### Added
- **New resources:**
  - `client.contaminations`: `list`, `get`, `create`
  - `client.comments`: `list`, `create`
  - `client.assets`: `list`, `get`, `create`, from a URL or base64
  - `client.mediaRecipes`: `list`, `get`, `create`, `update`
  - `client.pricing`: `listCultureLines`, `listEvents`
  - `client.commerce`: `listOrderLines`, `getSellThrough`
- **Plant and explant writes:** `plants.create`, `plants.update`,
  `explants.create`, `explants.update`. `plants.create()` resolves to
  `{ plant, warning }`, where `warning` is set when the first stage could not
  be recorded.
- **Equipment reads:** `equipment.list`, `equipment.get`, and
  `equipment.listEvents` for an item's usage, calibration and maintenance
  history.
- **`custom_fields`** on plants, explants and contaminations: the lab's own
  fields, returned on reads and accepted on writes.
- **`me.get()`** returns `effectiveScopes` (what the key can use right now,
  after its owner's role and the plan), `role` and `apiAccess` (`"full"` or
  `"devices"`).
- `Money` for exact decimal amounts, and error codes `PLAN_LIMIT_REACHED`,
  `FEATURE_NOT_INCLUDED`, `DUPLICATE_ENTRY`, `PLANT_WRITE_FORBIDDEN`,
  `EXPLANT_WRITE_FORBIDDEN`, `MEDIA_RECIPE_NOT_OWNER`, `PAYLOAD_TOO_LARGE`,
  `UNSUPPORTED_MEDIA_TYPE` and `IMAGE_URL_FETCH_FAILED`.
- The six new creates replay a repeated `Idempotency-Key`, which makes sixteen
  replaying endpoints.
- The new lists page by cursor from the start. `ListPromise` follows their
  `meta.next_cursor`.

### Changed
- **Breaking (types):** equipment maintenance kinds are now `calibration` and
  `preventive_maintenance`. Outcomes are now `pass`, `pass_after_adjustment`,
  `out_of_tolerance`, `fail` and `not_performed`. These are the values the API
  accepts.
- README:
  - Plans and access states the tiers. Teams and Enterprise get the full API.
    Hobby and Pro Lab get device-only keys. Free has no API access.
  - It also documents the role ceiling: a key never does more than its owner
    can in xPlant, and 402 means the plan while 403 means the key or role.
  - Every new resource has an example.
  - Links point at docs.xplantpro.com.
  - The `client.rateLimit` pacing example is removed. The API doesn't send
    `X-RateLimit-*` headers yet, so `client.rateLimit` stays `null`. Pace with
    `err.retryAfter` from a `429`.

## [0.4.0] — 2026-09-25

### Added
- `devices.revokeToken(deviceId, tokenId)` — revoke one device token. It is
  refused from its next request, and revoking twice is not an error.

### Changed
- `stages.advance()`, `transfers.create()`, `taskDemand.record()` and
  `devices.register()` now replay a repeated `Idempotency-Key`, so with
  `retry` on they are resent after a network failure like the other replaying
  writes. Ten endpoints replay a key.
- **Breaking (types):** `sensorReadings.create()` resolves to
  `SensorReading | null`. The API answers a reading that duplicates one already
  stored with no data, and the SDK used to return `undefined` typed as a
  reading.
- README: the idempotency table lists all ten endpoints, token revocation is
  documented, and the note about older routes using non-standard error codes
  is gone, now that those routes return standard codes.

## [0.3.0] — 2026-09-25

Covers the whole `/api/v1` surface — all 34 route and method pairs — and adds
device tokens, opt-in retries, idempotency keys and a paging helper. Pre-1.0.

0.2.0 was never published to npm, so **upgrading from 0.1.0 means taking both
this entry and the 0.2.0 entry below.** The changes most likely to touch
existing code are the envelope unwrapping and the new default host.

### Fixed
- **Default host is now `https://app.xplantpro.com`.** 0.2.0 set it to
  `https://www.xplantpro.com`, which is the marketing site and answers `401` to
  every `/api/*` path, even with a valid key. The key-creation link in errors
  and docs now points at `https://app.xplantpro.com/settings/integrations/api-keys`.
- `LabelResolveResult.record_type` can be `"container"`, with the cultures at
  that location in `contents`.
- `TaskSummary` gained `entity_link`, the plant or explant a task is about.

### Added
- **Every endpoint has a method.** New resources: `client.me`,
  `client.workspaces`, `client.explants`, `client.stages`, `client.transfers`,
  `client.events`, `client.taskDemand`, `client.sops`, `client.sopRuns` and
  `client.equipment`. New methods: `plants.findByExternalId()`,
  `explants.findByExternalId()`, `labels.recordScan()`, `devices.recordEvent()`,
  `devices.createToken()`, `devices.listTokens()` and
  `sensorReadings.createBatch()` (up to 500 readings per request).
- **Device tokens.** `new XPlantClient({ deviceToken })` for a device that
  should carry only its own credential. It throws when given anything but an
  `xpd_` token, so a workspace key cannot end up on a device by mistake.
- **Opt-in retry** (`retry: true`, or `{ maxRetries, baseDelayMs, maxDelayMs }`).
  `429` and `409 IDEMPOTENCY_IN_FLIGHT` are retried after `Retry-After` on any
  method. Network errors and `502`/`503`/`504` are retried for reads and for
  writes to endpoints that replay an `Idempotency-Key` — never for a write that
  might run twice.
- **`Idempotency-Key`.** Every write method takes `{ idempotencyKey }`. With
  retry on, the SDK generates one per call and reuses it across attempts.
- `XPlantError.retryAfter` (seconds, from `Retry-After`) and an
  `XPlantErrorCode` type listing the codes the API is known to return.
- **Auto-paging lists, ready for cursors.** Paged `list()` methods return a
  `ListPromise`. Awaiting it gives the first page, as before. Iterating it with
  `for await` gives every row, and `.pages()` gives whole pages, each with a
  `nextCursor` to resume from. It follows `meta.next_cursor` wherever an
  endpoint returns one and falls back to offsets elsewhere, so code is
  unchanged as the API moves its lists to cursors. `PageParams.cursor` resumes a
  saved cursor. `INVALID_CURSOR` is a known error code.
- **Timeouts.** Each attempt is abandoned after 60 s by default, with
  `XPlantTimeoutError`. The limit is set with `timeout` on the client or per
  call, and `0` disables it.
- **Typed network errors.** `XPlantConnectionError` is thrown when the API never
  answered, with the `fetch` error on `cause`. `XPlantTimeoutError` extends it.
- **`sensorReadings.buffer()`** for devices:
  - It batches readings, sends them on an interval or once 500 are waiting, and
    keeps them through outages.
  - It stamps `recorded_at` and `external_id`, so a resend is stored once.
  - It drops and reports readings the API rejects as invalid, without holding
    up the rest of the batch.
- `XPlantError.requestId` comes from `X-Request-Id`, and `client.rateLimit`
  from `X-RateLimit-*`. Both are `null` until the API sends those headers.
- Every method takes a trailing options object with an `AbortSignal` and a
  `timeout`. The signal also cancels a retry wait.
- `fetch` config option, for a custom or instrumented `fetch`.
- Task writes accept `is_all_day`, `genus`, `entity_type`/`entity_id`, and
  `clear_entity_link` on update. `plants.list()` accepts `external_id`.
- `SensorReadingPayload.external_id`, so a resent batch is not stored twice.
- `XPlantScope`, `API_KEYS_URL`, `DEFAULT_TIMEOUT_MS`, `MAX_PAGE_SIZE`,
  `MAX_SENSOR_BATCH`, and types for every new request and response.
- README: "Plans and access" explains that the API is included with xPlant+
  Teams and Enterprise, that a key unlocks what its plan allows, and that the
  plan's allowances still apply. It also links to the API guides in
  `xplant_os/docs`, and warns against calling the API from browser code.

### Changed
- `XPlantClientConfig.apiKey` is optional in the type, because `deviceToken`
  is the alternative. One of the two is still required at runtime.
- `EnvelopeRequestFn` takes an optional third `CallOptions` argument. A resource
  constructed directly with a two-argument function keeps working.
- `client.request()` and `client.requestEnvelope()` take the same optional
  `CallOptions`.
- A network failure throws `XPlantConnectionError` rather than the raw `fetch`
  error, which moves to `err.cause`.
- The vendored `src/testing/v1-surface.json` now records, per endpoint, which
  credentials it accepts and whether it replays an `Idempotency-Key`. The
  contract tests read both, check coverage in both directions, and check
  retry and device-token behaviour against them. The test fake now prefers a
  static route over a parameterised sibling, as the real router does.
- `npm run lint` works again: added an ESLint 9 flat config, and CI runs lint.
- The repository moved to [shmaplex/xplant_sdk](https://github.com/shmaplex/xplant_sdk).
  The package name is unchanged.

## [0.2.0] — 2026-08-06 — not published

> **Never published to npm.** Everything below first ships in 0.3.0, with one
> correction: the default host is `https://app.xplantpro.com`, not the `www`
> host this entry names.

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
- Types hand-aligned against the API's response serializers: `PlantSummary`
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
