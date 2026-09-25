// Shared types for @shmaplex/xplant-sdk
//
// These mirror what the xPlant `/api/v1` routes accept and return. Field names
// are the API's own, so casing follows the endpoint: the older record routes
// answer in snake_case, and the newer ones (`me`, SOPs, SOP runs, device tokens,
// label scans, equipment events) answer in camelCase.
//
// Response shapes only ever gain fields. Treat unknown fields as present and
// ignorable, and prefer the `(string & {})` fallbacks below over exhaustive
// switches on server-controlled values.

/**
 * The envelope every `/api/v1` route returns.
 *
 * Resource methods unwrap this for you and return `data` directly. Reach for
 * the envelope only via `client.requestEnvelope()`, when you need `meta`.
 */
export interface XPlantApiResponse<T> {
  /** `true` on success, `false` on failure. */
  ok?: boolean;
  data: T;
  /** Human-readable failure message. Absent or `null` on success. */
  error?: string | null;
  /** Stable machine-readable failure code. Absent on success. */
  code?: string;
  /** Extra out-of-band detail. See `TaskUpdateResult` for the task-write case. */
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Per-call options
// ---------------------------------------------------------------------------

/** Accepted as the last argument of every resource method. */
export interface RequestOptions {
  /** Abort the request, including any retry wait in progress. */
  signal?: AbortSignal;
}

/** Accepted as the last argument of every write method. */
export interface WriteOptions extends RequestOptions {
  /**
   * Sent as the `Idempotency-Key` header. Endpoints that support replay run
   * the write once per key and answer a repeat with the stored result for 24
   * hours; the rest ignore the header. 8–255 characters from
   * `A-Z a-z 0-9 . _ : ~ -`.
   *
   * When the client has `retry` enabled and you leave this unset, the SDK
   * generates one per call and reuses it across that call's attempts.
   */
  idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/**
 * The scopes an API key can hold, as offered on the API keys page. Some have no
 * endpoint yet; they are listed so a key can be minted ahead of the endpoint.
 */
export type XPlantScope =
  | "read:workspace"
  | "read:plants"
  | "write:plants"
  | "read:explants"
  | "write:explants"
  | "read:contaminations"
  | "write:contaminations"
  | "read:tasks"
  | "write:tasks"
  | "write:demand"
  | "read:comments"
  | "write:comments"
  | "read:assets"
  | "write:assets"
  | "read:media_recipes"
  | "write:media_recipes"
  | "read:transfers"
  | "write:transfers"
  | "read:sops"
  | "read:sop_runs"
  | "write:sop_runs"
  | "write:sop_steps"
  | "read:labels"
  | "write:label_scans"
  | "read:devices"
  | "write:devices"
  | "read:sensor_readings"
  | "write:sensor_readings"
  | "write:device_events"
  | "read:equipment"
  | "write:equipment_events"
  | "read:pricing"
  | "read:commerce"
  | "read:events"
  | (string & {});

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

/**
 * Offset paging, shared by every list endpoint that pages. The API has no
 * cursor and returns no total — a short page is the last page. See `paginate()`
 * to walk every page.
 */
export interface PageParams {
  /** Defaults to 50 server-side, capped at 200. */
  limit?: number;
  /** Defaults to 0. */
  offset?: number;
}

// ---------------------------------------------------------------------------
// Identity — `me` and `workspaces`
// ---------------------------------------------------------------------------

/** The public half of the API key a request was made with. */
export interface ApiKeyInfo {
  id: string;
  name: string;
  /** The visible prefix shown in settings after the key was created. */
  prefix: string;
  environment: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Returned by `me.get()`: what this key is, and what it may do. */
export interface MeResponse {
  key: ApiKeyInfo;
  /** Every scope this key holds, so you can check before you call. */
  scopes: XPlantScope[];
  /** The workspace this key acts in. A key is created in exactly one. */
  workspace: { id: string };
  user: { id: string | null };
}

export interface Workspace {
  id: string;
  name: string;
  /** `"lab"` for an ordinary workspace. */
  type: string;
}

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------

export interface PlantSummary {
  id: string;
  name: string;
  species: string;
  status: string;
  /** `null` for a solo workspace. */
  workspace_id: string | null;
  created_at: string | null;
  /**
   * Your own identifier for this plant (e.g. `"N2001"`), verbatim as supplied
   * at import — never normalized. `null` when the record was created without
   * one.
   */
  external_id: string | null;
}

/** Filters accepted by `plants.list()`. */
export interface PlantListParams extends PageParams {
  /**
   * Look up one plant by your own identifier instead of paging. The result is
   * still an array — of at most one element — so the shape does not change
   * with the query. Paging params are ignored when this is set.
   */
  external_id?: string;
}

// ---------------------------------------------------------------------------
// Explants
// ---------------------------------------------------------------------------

export interface ExplantSummary {
  id: string;
  label: string | null;
  /**
   * Your own batch identifier (e.g. `"N2001"`), verbatim as supplied at import.
   * Resolved from the batch code, then the batch number, then the label.
   */
  external_id: string | null;
  status: string;
  /** The plant this batch was initiated from, when one is recorded. */
  plant_id: string | null;
  /** `null` for a solo workspace. */
  workspace_id: string | null;
  initial_count: number | null;
  current_count: number | null;
  created_at: string | null;
}

/** Filters accepted by `explants.list()`. */
export interface ExplantListParams extends PageParams {
  /**
   * Look up one batch by your own identifier instead of paging. The result is
   * still an array — of at most one element — so the shape does not change
   * with the query. Paging params are ignored when this is set.
   */
  external_id?: string;
}

// ---------------------------------------------------------------------------
// Entity targets — shared by stages, transfers and events
// ---------------------------------------------------------------------------

export type EntityType = "plant" | "explant";

/** Either a plant or an explant, never both. The API rejects both and neither. */
export type EntityTarget =
  | { plant_id: string; explant_id?: never }
  | { explant_id: string; plant_id?: never };

// ---------------------------------------------------------------------------
// Events — plant and explant change history
// ---------------------------------------------------------------------------

export interface EventSummary {
  id: string;
  entity_type: EntityType;
  /** The plant or explant this event belongs to, per `entity_type`. */
  entity_id: string;
  stage_id: string | null;
  event_type: string;
  event_time: string;
  recorded_by: string | null;
  /** Event-specific detail. The shape varies by `event_type`. */
  payload: unknown;
  created_at: string;
}

/** Filters accepted by `events.list()`. */
export interface EventListParams extends PageParams {
  /**
   * Required. Plant and explant history are paged independently, so there is
   * no combined feed — call once per entity type.
   */
  entity: EntityType;
  /**
   * ISO 8601. Returns only events created strictly after this instant. Events
   * are immutable and insert-ordered, so save the newest `created_at` you have
   * seen and pass it back to pull deltas.
   */
  since?: string;
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export interface StageSummary {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  /** Stage name, e.g. `"multiplication"`. */
  stage: string;
  /** `"active"` for the current stage, `"completed"` once superseded. */
  status: string;
  entered_on: string | null;
  completed_at: string | null;
  room_id: string | null;
  notes: string | null;
  created_at: string | null;
}

/** Target and paging accepted by `stages.list()`. */
export type StageListParams = EntityTarget & PageParams;

/** Payload sent when advancing a plant or explant to a new stage. */
export type StageAdvanceInput = EntityTarget & {
  /** 1–50 characters. */
  stage: string;
  /** `YYYY-MM-DD` or a full ISO timestamp. Defaults to today. */
  entered_on?: string;
  room_id?: string;
  /** Up to 5000 characters. */
  notes?: string;
};

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export interface TransferSummary {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  transfer_date: string | null;
  /** 1-based subculture count for this plant or explant. */
  transfer_cycle: number | null;
  from_location: string | null;
  to_location: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
}

/** Target and paging accepted by `transfers.list()`. */
export type TransferListParams = EntityTarget & PageParams;

/** Payload sent when recording a transfer. */
export type TransferCreateInput = EntityTarget & {
  /** `YYYY-MM-DD` or a full ISO timestamp. Defaults to today. */
  transfer_date?: string;
  /** Up to 200 characters. */
  from_location?: string;
  /** Up to 200 characters. */
  to_location?: string;
  /** Positive integer. Continues from the last recorded cycle when omitted. */
  transfer_cycle?: number;
  /** Up to 5000 characters. */
  notes?: string;
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskWorkflowStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "waiting_blocked"
  | "review"
  | "done";

export type TaskCategory =
  | "media_prep"
  | "transfer"
  | "contamination"
  | "subculture"
  | "sop_review"
  | "acclimation"
  | "cleaning"
  | "monitoring"
  | "other";

/**
 * Who owns a task's queue position.
 *
 * - `default` — never positioned.
 * - `auto` — positioned by an integration.
 * - `manual` — positioned by a person. Writes over this API leave it alone
 *   unless you send `release: true`.
 */
export type PrioritySource = "default" | "auto" | "manual";

/** The plant or explant a task is about. */
export interface TaskEntityLink {
  entity_type: EntityType;
  entity_id: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  priority: string | null;
  /** Queue position. Lower sorts first; `null` means the label decides. */
  priority_rank: number | null;
  priority_source: PrioritySource | (string & {});
  category: string | null;
  created_at: string | null;
  /**
   * The plant or explant this task is about. Returned by `get()`, `update()`,
   * and by `create()` when you set one; omitted from `list()`, which does not
   * pay for the extra lookup. `null` means the task has no link.
   */
  entity_link?: TaskEntityLink | null;
}

/** Filters accepted by `tasks.list()`. */
export interface TaskListParams extends PageParams {
  /** Matched against the task's workflow status. */
  status?: TaskWorkflowStatus | (string & {});
  /** User id. Must be an active member of the key's workspace. */
  assigned_to?: string;
}

/** Payload sent when creating a task. */
export interface TaskCreateInput {
  /** 1–300 characters. */
  title: string;
  /** ISO 8601 **with an offset**. Defaults to now. */
  due_date?: string;
  /** `true` when only the due date matters, not the time. */
  is_all_day?: boolean;
  /** Defaults to `"media_prep"`. */
  category?: TaskCategory;
  /** Up to 5000 characters. */
  notes?: string;
  priority?: TaskPriority;
  /** Fractional queue position — drop a task between two neighbours. */
  priority_rank?: number | null;
  /** Defaults to `"todo"`. */
  workflow_status?: TaskWorkflowStatus;
  /** User id. Must be an active member of the key's workspace. */
  assigned_to?: string;
  /** The genus this work is for, matching demand signals. 1–100 characters. */
  genus?: string;
  /** Link the task to a plant or explant. Send together with `entity_id`. */
  entity_type?: EntityType;
  /** Send together with `entity_type`. */
  entity_id?: string;
}

/** Payload sent when updating a task. At least one field is required. */
export interface TaskUpdateInput extends Omit<Partial<TaskCreateInput>, "genus"> {
  /** `null` clears the genus. */
  genus?: string | null;
  /**
   * Take a hand-ordered task back under automatic control. Without this, an
   * ordering change to a task whose `priority_source` is `manual` is skipped.
   */
  release?: boolean;
  /** Remove the task's plant or explant link. Not combinable with `entity_type`/`entity_id`. */
  clear_entity_link?: boolean;
}

/**
 * How the API resolved an attempted ordering change.
 *
 * Reported only when the request tried to change ordering — that is, when it
 * carried `priority`, `priority_rank`, or `release`.
 */
export interface PriorityWriteReport {
  /** `false` means the ordering change was declined; the rest of the patch still applied. */
  applied: boolean;
  /** Present only when declined. */
  reason?: "manual_override";
  /** The source that won. */
  priority_source: PrioritySource | (string & {});
  message: string;
}

/**
 * Result of `tasks.update()`.
 *
 * A declined ordering change is a success, not an error — the request returns
 * 200 and the non-ordering fields still apply. Check `skipped` (or
 * `priority_write.applied`) rather than assuming the whole patch landed.
 */
export interface TaskUpdateResult {
  /** The task as stored after the write — the order that won, not what you sent. */
  task: TaskSummary;
  /** `null` when the request did not attempt an ordering change. */
  priority_write: PriorityWriteReport | null;
  /** `true` when an ordering change was declined by the manual-override rule. */
  skipped: boolean;
}

// ---------------------------------------------------------------------------
// Task demand signals
// ---------------------------------------------------------------------------

export interface DemandSignalSummary {
  id: string;
  genus: string;
  /** Free-form classification of where the number came from, e.g. `"tissue"`. */
  source_type: string | null;
  demand_score: number;
  /** The system that reported it. */
  source: string;
  observed_at: string;
  created_at: string;
}

/** Filters accepted by `taskDemand.list()`. */
export interface TaskDemandListParams extends PageParams {
  /** Narrow to one genus. */
  genus?: string;
  /**
   * With `genus`, return the single current reading instead of its history.
   * Has no effect without `genus`. The row it returns has the id `"current"`
   * and a generated timestamp — it is a reading, not a stored record, so do
   * not treat its `id` as addressable.
   */
  current?: boolean;
}

/** Payload sent when pushing a demand signal. */
export interface TaskDemandCreateInput {
  /** 1–100 characters. */
  genus: string;
  /** Up to 50 characters, e.g. `"seed"` or `"tissue"`. */
  source_type?: string;
  /** Non-negative. */
  demand_score: number;
  /** 1–100 characters — the name of the system pushing the number. */
  source: string;
  /** ISO 8601 **with an offset**. Defaults to now. */
  observed_at?: string;
}

// ---------------------------------------------------------------------------
// SOPs
// ---------------------------------------------------------------------------

export interface SopSummary {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string | null;
  level: string | null;
  tags: string[];
  equipment: string[];
  estimatedTimeMinutes: number | null;
  durationHours: number | null;
  currentVersion: number;
  updatedAt: string | null;
  createdAt: string | null;
}

/** The version of a protocol the lab works from right now. */
export interface SopEffectiveVersion {
  version: number;
  lifecycleStatus: "effective";
  effectiveAt: string | null;
  approvedAt: string | null;
  /** The approved procedure. The step shape is the version's own. */
  steps: unknown[];
  title: string | null;
  description: string | null;
}

/** Returned by `sops.get()`. */
export interface SopDetail extends SopSummary {
  /**
   * The version in force, or `null` when the lab has none — in which case
   * there are no steps to follow. Never a draft or a not-yet-effective version.
   */
  version: SopEffectiveVersion | null;
}

// ---------------------------------------------------------------------------
// SOP runs
// ---------------------------------------------------------------------------

export interface SopRun {
  id: string;
  sopId: string | null;
  /** The version this run is pinned to. Set once, at start, and never moved. */
  version: number | null;
  versionId: string | null;
  status: string;
  batchCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  progress: number;
  steps: unknown[];
}

/** Evidence posted against one step of a run. */
export interface SopStepEvent {
  id: string;
  runId: string;
  stepKey: string;
  /** One of `SopStepEventType`, or `"measured"` for a measurement. */
  eventType: string;
  recordedAt: string;
  payload: Record<string, unknown>;
}

/** Returned by `sopRuns.get()`. */
export interface SopRunDetail extends SopRun {
  /** Evidence posted against this run, oldest first. */
  events: SopStepEvent[];
}

/** Payload sent when starting a run. The effective version is always pinned. */
export interface SopRunStartInput {
  sop_id: string;
  /** Your own identifier for what is being run. Up to 120 characters. */
  batch_code?: string;
  plant_id?: string;
}

export type SopStepEventType = "confirmed" | "scanned" | "skipped" | "note" | "device_state";

/** Payload sent to `sopRuns.recordStepEvent()`. */
export interface SopStepEventInput {
  event_type: SopStepEventType;
  /** Defaults to `{}`. */
  payload?: Record<string, unknown>;
  /** ISO 8601. Defaults to now. */
  recorded_at?: string;
}

/** Payload sent to `sopRuns.recordMeasurement()`. */
export interface SopMeasurementInput {
  /** What was measured, e.g. `"ph"` or `"mass"`. 1–60 characters. */
  metric: string;
  value: number;
  /** Required — a number with no unit is not a measurement. 1–20 characters. */
  unit: string;
  /** ISO 8601. Defaults to now. */
  recorded_at?: string;
  /** Up to 500 characters. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Labels and label scans
// ---------------------------------------------------------------------------

/** One item inside a scanned container. */
export interface LabelResolveContentItem {
  item_id: string;
  record_type: "plant" | "explant" | null;
  record_id: string | null;
  display_name: string;
  url: string | null;
}

export interface LabelResolveResult {
  /** Echoes the trimmed input. */
  barcode: string;
  record_type: "plant" | "explant" | "container";
  record_id: string;
  display_name: string;
  /** Relative in-app path, e.g. `/dashboard/plants/<id>`. */
  url: string;
  /** Present only when `record_type` is `"container"` — the cultures at that location. */
  contents?: LabelResolveContentItem[];
}

/** Payload sent when recording a scan. */
export interface LabelScanInput {
  /** The code as the scanner read it. 1–512 characters. */
  barcode: string;
  /** What it resolved to, when you already know. */
  plant_id?: string;
  explant_id?: string;
  /** Where the scan happened — a bench, a shelf, a door. Up to 120 characters. */
  context?: string;
  /** ISO 8601. Defaults to now. */
  scanned_at?: string;
}

export interface LabelScan {
  id: string;
  barcode: string;
  /** `true` when the scan named a plant or explant. Derived, never sent. */
  resolved: boolean;
  plantId: string | null;
  explantId: string | null;
  context: string | null;
  scannedAt: string;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export type DeviceType = "sensor" | "controller" | "gateway";

/** Payload sent when registering a device. */
export interface DeviceRegisterPayload {
  /** 1–100 characters. */
  name: string;
  /** Defaults to `"sensor"`. */
  type?: DeviceType;
  /** Up to 100 characters. */
  hardware?: string;
  /** Up to 50 characters. */
  firmware_version?: string;
  room_id?: string;
  metadata?: Record<string, unknown>;
}

export interface DeviceSummary {
  id: string;
  name: string;
  type: string;
  hardware: string | null;
  status: string;
  firmware_version: string | null;
  room_id: string | null;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Optional metadata included in a heartbeat.
 *
 * @deprecated The heartbeat endpoint reads no request body, so these values are
 * discarded. Set firmware and room details through `devices.register()`.
 */
export interface DeviceHeartbeatPayload {
  firmware_version?: string;
  ip_address?: string;
  /** Wi-Fi signal strength in dBm. */
  rssi?: number;
}

/** Response returned by the heartbeat endpoint. */
export interface HeartbeatResponse {
  /** ISO 8601 instant the heartbeat was recorded. */
  received_at: string;
}

// ---------------------------------------------------------------------------
// Device tokens
// ---------------------------------------------------------------------------

/** Payload sent when creating a device token. Every field is optional. */
export interface DeviceTokenCreateInput {
  /** A label to tell tokens apart. Up to 120 characters. */
  name?: string;
  /** Defaults to `"production"`, which issues an `xpd_live_…` token. */
  environment?: "production" | "development";
}

/** Returned once, by `devices.createToken()`. */
export interface DeviceTokenMinted {
  id: string;
  deviceId: string;
  name: string | null;
  prefix: string;
  /** The secret. Returned only here, at creation — it cannot be read back later. */
  token: string;
  createdAt: string;
}

/** Returned by `devices.listTokens()`. Never includes the secret. */
export interface DeviceTokenSummary {
  id: string;
  deviceId: string;
  name: string | null;
  prefix: string;
  status: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Device events
// ---------------------------------------------------------------------------

export type DeviceEventType =
  | "heartbeat"
  | "alert"
  | "firmware_update"
  | "config_change"
  | "error"
  | "other";

/** Payload sent when recording a device event. */
export interface DeviceEventPayload {
  device_id: string;
  event_type: DeviceEventType;
  payload?: Record<string, unknown>;
  /** ISO 8601. Defaults to server receipt time if omitted. */
  occurred_at?: string;
}

/** A device event as returned by the API. */
export interface DeviceEvent {
  id: string;
  device_id: string;
  /** See the note on `SensorReading.team_id`. */
  team_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Sensor readings
// ---------------------------------------------------------------------------

export type SensorType =
  | "temperature"
  | "humidity"
  | "ph"
  | "co2"
  | "light"
  | "other";

export type SensorUnit = "C" | "F" | "%" | "ppm" | "lux" | "pH" | "mS/cm";

/** Payload sent when creating a sensor reading. */
export interface SensorReadingPayload {
  device_id: string;
  type: SensorType;
  value: number;
  /** Free-form, 1–20 characters. */
  unit: SensorUnit | (string & {});
  /**
   * ISO 8601. Defaults to server receipt time if omitted — but required when
   * `external_id` is set, so a replayed reading carries the same timestamp.
   */
  recorded_at?: string;
  room_id?: string;
  /** Up to 500 characters. */
  notes?: string;
  /**
   * Your own id for this reading, 1–200 characters. A second reading from the
   * same device with the same `external_id` and `recorded_at` is dropped as a
   * duplicate, so a batch retried after a network failure is not stored twice.
   */
  external_id?: string;
  /**
   * @deprecated The API field is `recorded_at`. Passing `timestamp` still works
   * — it is mapped to `recorded_at` when that is not set — but it was silently
   * dropped by the server before 0.2.0, so readings landed stamped "now".
   */
  timestamp?: string;
}

/** A sensor reading as returned by the API. */
export interface SensorReading {
  id: string;
  device_id: string;
  /**
   * The owning workspace. This endpoint returns the raw column name, so it is
   * `team_id` here where the plant and task records say `workspace_id`.
   */
  team_id: string;
  room_id: string | null;
  type: string;
  value: number;
  unit: string;
  recorded_at: string;
  notes: string | null;
  created_at: string;
}

/** Filters accepted by `sensorReadings.list()`. */
export interface SensorReadingListParams {
  device_id?: string;
  room_id?: string;
  type?: SensorType | (string & {});
  /** ISO 8601 — only readings recorded at or after this instant. */
  since?: string;
  /** Defaults to 100 server-side, capped at 1000. This endpoint has no offset. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Equipment events
// ---------------------------------------------------------------------------

/** What a piece of equipment was used on. */
export type EquipmentUsageSubjectType =
  | "sop_log"
  | "media_batch"
  | "plant_transfer"
  | "explant_transfer"
  | "contamination_log";

/** "This equipment was used on that record." */
export interface EquipmentUsageEventInput {
  kind: "used";
  subject_type: EquipmentUsageSubjectType;
  /** Must belong to your workspace. */
  subject_id: string;
  /** Up to 200 characters. */
  subject_label?: string;
  /** ISO 8601. Defaults to now. */
  used_at?: string;
  /** Up to 2000 characters. */
  notes?: string;
}

export type EquipmentMaintenanceKind = "calibration" | "service" | "fault" | "verification";

export type EquipmentMaintenanceOutcome = "pass" | "fail" | "adjusted" | "inconclusive";

/** "This equipment was calibrated, serviced, verified, or faulted." */
export interface EquipmentMaintenanceEventInput {
  kind: EquipmentMaintenanceKind;
  /** Defaults to `"pass"`. */
  outcome?: EquipmentMaintenanceOutcome;
  /** ISO 8601. Defaults to now. */
  performed_at?: string;
  /** Up to 200 characters. */
  performed_by_name?: string;
  /** Up to 2000 characters. */
  result_summary?: string;
  /** Up to 2000 characters. */
  notes?: string;
}

/** Payload sent to `equipment.recordEvent()`, discriminated on `kind`. */
export type EquipmentEventInput = EquipmentUsageEventInput | EquipmentMaintenanceEventInput;

export interface EquipmentEvent {
  id: string;
  equipmentId: string;
  kind: string;
  recordedAt: string;
}
