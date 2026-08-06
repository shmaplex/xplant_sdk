// Shared types for the @xplant/sdk

/** Generic API response wrapper */
export interface XPlantApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

// ---------------------------------------------------------------------------
// Sensor readings
// ---------------------------------------------------------------------------

export type SensorType =
  | "temperature"
  | "humidity"
  | "co2"
  | "light_lux"
  | "ph"
  | "ec";

export type SensorUnit = "C" | "F" | "%" | "ppm" | "lux" | "pH" | "mS/cm";

/** Payload sent when creating a new sensor reading. */
export interface SensorReadingPayload {
  device_id: string;
  type: SensorType | (string & {});
  value: number;
  unit: SensorUnit | (string & {});
  /** ISO 8601. Defaults to server receipt time if omitted. */
  timestamp?: string;
}

/** A sensor reading as returned by the API. */
export interface SensorReading extends SensorReadingPayload {
  id: string;
  timestamp: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Device events
// ---------------------------------------------------------------------------

/** Payload sent when recording a device event. */
export interface DeviceEventPayload {
  device_id: string;
  event_type: string;
  /** Arbitrary JSON payload, max 4 KB. */
  payload?: Record<string, unknown>;
  /** ISO 8601. Defaults to server receipt time if omitted. */
  timestamp?: string;
}

/** A device event as returned by the API. */
export interface DeviceEvent extends DeviceEventPayload {
  id: string;
  timestamp: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

/** Optional metadata included in a heartbeat. */
export interface DeviceHeartbeatPayload {
  firmware_version?: string;
  ip_address?: string;
  /** Wi-Fi signal strength in dBm. */
  rssi?: number;
}

/** Response returned by the heartbeat endpoint. */
export interface HeartbeatResponse {
  device_id: string;
  last_seen_at: string;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export interface DeviceSummary {
  id: string;
  name: string;
  type: string;
  last_seen_at: string | null;
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
  /** `null` for a solo workspace with no team. */
  workspace_id: string | null;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskPriority = "low" | "medium" | "high" | "urgent";

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

export type WorkflowStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "waiting_blocked"
  | "review"
  | "done";

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  priority: TaskPriority | null;
  category: TaskCategory | null;
  created_at: string | null;
}

/** Payload for `client.tasks.create()`. Requires the `write:tasks` scope. */
export interface TaskCreatePayload {
  title: string;
  /** ISO 8601 with a UTC offset. Defaults to now if omitted. */
  due_date?: string;
  /** Defaults to `"media_prep"` if omitted. */
  category?: TaskCategory;
  notes?: string;
  priority?: TaskPriority;
  /** Defaults to `"todo"` if omitted. */
  workflow_status?: WorkflowStatus;
  /** Must be an active member of the key's workspace, or the request is rejected with 422. */
  assigned_to?: string;
}

/** Payload for `client.tasks.update()`. Only supplied fields change; at least one is required. */
export type TaskUpdatePayload = Partial<TaskCreatePayload>;

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export interface LabelResolveResult {
  barcode: string;
  record_type: "plant" | "explant";
  record_id: string;
  display_name: string;
  /** In-app path to the resolved record (relative, e.g. `/dashboard/plants/{id}`). */
  url: string;
}
