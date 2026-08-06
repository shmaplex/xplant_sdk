// Shared types for the @xplant/sdk
//
// These mirror the serializers the xPlant external API returns
// (`lib/api/v1/serializers.ts` in the app repo, which is the contract of record).

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
// Paging
// ---------------------------------------------------------------------------

/**
 * Offset paging, supported by `plants.list()` and `tasks.list()`.
 * The API has no cursor and returns no total — a short page is the last page.
 */
export interface PageParams {
  /** Defaults to 50 server-side, capped at 200. */
  limit?: number;
  /** Defaults to 0. */
  offset?: number;
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

/** Payload sent when creating a new sensor reading. */
export interface SensorReadingPayload {
  device_id: string;
  type: SensorType;
  value: number;
  /** Free-form, 1–20 characters. */
  unit: SensorUnit | (string & {});
  /** ISO 8601. Defaults to server receipt time if omitted. */
  recorded_at?: string;
  room_id?: string;
  /** Up to 500 characters. */
  notes?: string;
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
   * `team_id` here where the plant and task serializers say `workspace_id`.
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
// Devices
// ---------------------------------------------------------------------------

export type DeviceType = "sensor" | "controller" | "gateway";

/** Payload sent when registering a device. */
export interface DeviceRegisterPayload {
  /** 1–100 characters. */
  name: string;
  /** Defaults to `"sensor"`. */
  type?: DeviceType;
  hardware?: string;
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
}

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
  /** ISO 8601 with offset. Defaults to now. */
  due_date?: string;
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
}

/** Payload sent when updating a task. At least one field is required. */
export interface TaskUpdateInput extends Partial<TaskCreateInput> {
  /**
   * Take a hand-ordered task back under automatic control. Without this, an
   * ordering change to a task whose `priority_source` is `manual` is skipped.
   */
  release?: boolean;
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
// Labels
// ---------------------------------------------------------------------------

export interface LabelResolveResult {
  /** Echoes the trimmed input. */
  barcode: string;
  record_type: "plant" | "explant";
  record_id: string;
  display_name: string;
  /** Relative in-app path, e.g. `/dashboard/plants/<id>`. */
  url: string;
}
