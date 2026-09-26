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
  /**
   * The API's id for this request, from the `X-Request-Id` header — set by the
   * SDK, not part of the response body. Quote it when contacting support.
   */
  requestId?: string | null;
}

// ---------------------------------------------------------------------------
// Per-call options
// ---------------------------------------------------------------------------

/** Accepted as the last argument of every resource method. */
export interface RequestOptions {
  /** Abort the request, including any retry wait in progress. */
  signal?: AbortSignal;
  /**
   * Milliseconds each attempt may take, including reading the response, before
   * it fails with `XPlantTimeoutError`. Overrides the client's `timeout`.
   */
  timeout?: number;
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
 * Paging, shared by every list endpoint that pages. Most callers never set
 * these: iterate the list and the SDK fetches every page. See `ListPromise`.
 */
export interface PageParams {
  /** Rows per page. Defaults to 50 server-side, capped at 200. */
  limit?: number;
  /** Rows to skip. Defaults to 0. Not combinable with `cursor`. */
  offset?: number;
  /**
   * Resume from a page's `nextCursor` (see `ListPromise.pages()`), with the same
   * filters it was issued for. A cursor the API no longer accepts answers
   * `422 INVALID_CURSOR`; start again from the first page.
   */
  cursor?: string;
}

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/**
 * An exact amount of money. `amount` is a decimal written as text, e.g.
 * `"1250.00"` — never a floating-point number, so parse it with a decimal type
 * rather than `Number()` when the value matters.
 */
export interface Money {
  amount: string;
  /** ISO 4217 code, e.g. `"USD"`. */
  currency: string | null;
}

/**
 * The lab's own fields on a record, keyed by each field's key as set up in the
 * lab's settings. Values are text, numbers, booleans, or dates written as
 * `YYYY-MM-DD`; a blank field is absent or `null`. Empty when the lab has set
 * up no fields. Writing a value the field does not accept answers
 * `422 VALIDATION_ERROR` with a `custom_fields:` message.
 */
export type CustomFieldValues = Record<string, string | number | boolean | null>;

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

/** A member's role in a workspace, from most to least access. */
export type WorkspaceRole =
  | "owner"
  | "admin"
  | "manager"
  | "member"
  | "viewer"
  | "guest"
  | (string & {});

/** Returned by `me.get()`: what this key is, and what it may do. */
export interface MeResponse {
  key: ApiKeyInfo;
  /** Every scope the key was created with. */
  scopes: XPlantScope[];
  /**
   * The scopes this key can use right now: its own scopes, narrowed by its
   * owner's current role and the workspace's plan. Check this one before you
   * call — a key never does more than its owner can in xPlant.
   */
  effectiveScopes: XPlantScope[];
  /** The key owner's role in the workspace. */
  role: WorkspaceRole;
  /**
   * `"full"` on xPlant+ Teams and Enterprise. `"devices"` on plans whose keys
   * can connect devices only: registering them, managing their tokens, and
   * posting their readings and events.
   */
  apiAccess: "full" | "devices" | (string & {});
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
   * Your own identifier for this plant (e.g. `"LINE-0412"`), verbatim as supplied
   * at import — never normalized. `null` when the record was created without
   * one.
   */
  external_id: string | null;
  /** The lab's own fields. See {@link CustomFieldValues}. */
  custom_fields: CustomFieldValues;
}

export type PlantStatus =
  | "active"
  | "dormant"
  | "harvested"
  | "contaminated"
  | "failed"
  | "in_culture"
  | "ready_for_transfer"
  | "quarantined"
  | "archived";

/** The stage a new plant starts in. */
export type PlantStage =
  | "Mother Block"
  | "Acclimation"
  | "Production"
  | "Cold Storage"
  | "Quarantine"
  | "Propagation"
  | "Hardening Off"
  | "Greenhouse"
  | "Field"
  | "Discarded";

/** Payload sent when creating a plant. */
export interface PlantCreateInput {
  /** 1–200 characters. */
  species: string;
  common_name?: string | null;
  genus?: string | null;
  family?: string | null;
  cultivar?: string | null;
  source?: string | null;
  /** Up to 5000 characters. */
  notes?: string | null;
  status?: PlantStatus;
  /** The stage the plant starts in. */
  initial_stage?: PlantStage;
  /** Your own identifier, 1–100 characters. One already in use answers `409 DUPLICATE_ENTRY`. */
  external_id?: string | null;
  custom_fields?: CustomFieldValues;
}

/** Payload sent when updating a plant. Only the fields you send change. */
export type PlantUpdateInput = Partial<Omit<PlantCreateInput, "initial_stage">>;

/** Result of `plants.create()`. */
export interface PlantCreateResult {
  plant: PlantSummary;
  /**
   * Set only when the plant was saved but its first stage could not be. Record
   * one with `stages.advance()`. `null` when everything was saved.
   */
  warning: string | null;
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
   * Your own batch identifier (e.g. `"LINE-0412"`), verbatim as supplied at import.
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
  /** The lab's own fields. See {@link CustomFieldValues}. */
  custom_fields: CustomFieldValues;
}

export type ExplantStatus =
  | "active"
  | "establishing"
  | "growing"
  | "needs_subculture"
  | "quarantined"
  | "senescing"
  | "discarded"
  | "retired"
  | "lost";

/** Payload sent when creating an explant (batch). */
export interface ExplantCreateInput {
  /** 1–200 characters. */
  label: string;
  /** The plant it was initiated from. */
  plant_id?: string | null;
  /** Up to 100 characters. */
  batch_number?: string | null;
  /** Up to 5000 characters. */
  notes?: string | null;
  status?: ExplantStatus;
  /** Your own identifier, 1–100 characters. One already in use answers `409 DUPLICATE_ENTRY`. */
  external_id?: string | null;
  custom_fields?: CustomFieldValues;
}

/** Payload sent when updating an explant. Only the fields you send change. */
export type ExplantUpdateInput = Partial<Omit<ExplantCreateInput, "plant_id">>;

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
  /**
   * The stage's key in the lab's stage list, e.g. `"multiplication"` — the
   * key, whatever casing was sent.
   */
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
  /**
   * A stage from the lab's own stage list for plants or explants, 1–50
   * characters. Matched against the list's names and keys. A stage the lab
   * doesn't use — or an explant-only stage sent for a plant — answers
   * `422 VALIDATION_ERROR`.
   */
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
  /** `"completed"` or `"pending"` for transfers recorded now; older ones may read `"active"`. */
  status: TransferStatus | (string & {});
  notes: string | null;
  created_at: string | null;
  /** The lab's own fields. See {@link CustomFieldValues}. */
  custom_fields: CustomFieldValues;
}

/** Whether a transfer has happened (`completed`) or is planned (`pending`). */
export type TransferStatus = "completed" | "pending";

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
  /** Defaults to `"completed"`. */
  status?: TransferStatus;
  custom_fields?: CustomFieldValues;
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
  /** The lab's own name for a custom category, beside `category: "other"`. `null` when there is none. */
  category_label: string | null;
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
  /**
   * Defaults to `"media_prep"`. For a category of your own, send `"other"`
   * with a `category_label`. A value outside these presets answers
   * `422 VALIDATION_ERROR`, naming the field.
   */
  category?: TaskCategory;
  /**
   * Your own name for the category, 1–60 characters — allowed only beside
   * `category: "other"`, in the same request; with any other category it
   * answers `422 VALIDATION_ERROR`. `null` clears it on update.
   */
  category_label?: string | null;
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

/**
 * Where the key owner's training on an SOP stands, sent when the lab enforces
 * training as a warning or when training lapses within 30 days.
 */
export interface TrainingWarning {
  /**
   * `untrained` — no training recorded; `expired` — it has lapsed; `revoked` —
   * it was withdrawn; `expiring` — current, but lapses within 30 days.
   */
  qualification: "untrained" | "expired" | "revoked" | "expiring" | (string & {});
  /** `YYYY-MM-DD` for `expired` and `expiring`; `null` otherwise. */
  expires_on: string | null;
}

/** Returned by `sopRuns.start()`: the run, plus any training warning. */
export interface SopRunStarted extends SopRun {
  /**
   * Set when the lab warns rather than blocks on training, or the owner's
   * training lapses within 30 days — `null` otherwise. Added by the SDK from
   * the response's `meta`; show it to the operator.
   */
  trainingWarning: TrainingWarning | null;
}

/** Payload sent when starting a run. The effective version is always pinned. */
export interface SopRunStartInput {
  sop_id: string;
  /** Your own identifier for what is being run. Up to 120 characters. */
  batch_code?: string;
  plant_id?: string;
}

export type SopStepEventType = "confirmed" | "scanned" | "skipped" | "note" | "device_state";

/** How a run ended. Only `completed` sets `completedAt`. */
export type SopRunOutcome = "completed" | "failed" | "cancelled";

/** Payload sent to `sopRuns.complete()`. */
export interface SopRunCompleteInput {
  outcome: SopRunOutcome;
  /** Up to 1000 characters, trimmed. Appended to the run's notes, never replacing them. */
  notes?: string;
}

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
  /**
   * Your own id for the event, 1–200 characters. An event with the same device
   * and `external_id` as one already stored is not recorded again — the stored
   * event is returned instead — so a retried request records the event once.
   */
  external_id?: string;
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
   *
   * A device has one channel per `type`: register a second probe of the same
   * type as its own device, or two same-moment readings would be one.
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
  /**
   * ISO 8601 — only readings recorded at or before this instant (inclusive).
   * A `since` later than `until` answers `422 VALIDATION_ERROR`.
   */
  until?: string;
  /** Rows per page. Defaults to 100, capped at 1000. */
  limit?: number;
  /** Resume from a page's `nextCursor`. */
  cursor?: string;
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

export type EquipmentMaintenanceKind = "calibration" | "preventive_maintenance";

export type EquipmentMaintenanceOutcome =
  | "pass"
  | "pass_after_adjustment"
  | "out_of_tolerance"
  | "fail"
  | "not_performed";

/** "This equipment was calibrated, or had preventive maintenance." */
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

/** An equipment item in the lab's library. */
export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory | (string & {});
  /** `"active"` or `"archived"`. */
  status: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  purchase_date: string | null;
  vendor_url: string | null;
  notes: string | null;
  last_calibrated_at: string | null;
  next_calibration_due_at: string | null;
  last_maintenance_at: string | null;
  next_maintenance_due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type EquipmentCategory =
  | "balance_scale"
  | "autoclave_pressure_cooker"
  | "laminar_flow_hood"
  | "still_air_box"
  | "incubator"
  | "light_rack"
  | "fridge_freezer"
  | "ph_ec_meter"
  | "microscope"
  | "label_printer"
  | "other";

/** Filters accepted by `equipment.list()`. */
export interface EquipmentListParams extends PageParams {
  category?: EquipmentCategory;
  status?: "active" | "archived";
}

/** One entry in an equipment item's history, from `equipment.listEvents()`. */
export interface EquipmentHistoryEntry {
  id: string;
  equipment_id: string;
  /** `"used"`, `"calibration"` or `"preventive_maintenance"`. */
  kind: string;
  occurred_at: string | null;
  outcome: string | null;
  subject_type: string | null;
  subject_id: string | null;
  subject_label: string | null;
  performed_by_name: string | null;
  provider: string | null;
  as_found_condition: string | null;
  as_left_condition: string | null;
  result_summary: string | null;
  certificate_number: string | null;
  certificate_url: string | null;
  next_due_at: string | null;
  notes: string | null;
}

/** Filters accepted by `equipment.listEvents()`. */
export interface EquipmentHistoryParams extends PageParams {
  kind?: "used" | EquipmentMaintenanceKind;
  /** ISO 8601 — only entries at or after this instant. */
  from?: string;
  /** ISO 8601 — only entries before this instant. */
  to?: string;
}

// ---------------------------------------------------------------------------
// Contaminations
// ---------------------------------------------------------------------------

export type ContaminationType =
  | "mold"
  | "bacteria"
  | "hyperhydricity"
  | "phenolic"
  | "algae"
  | "yeast"
  | "endophytic"
  | "viral"
  | "fungal"
  | "physiological"
  | "contaminated_media"
  | "damage"
  | "insect"
  | "other";

export type ContaminationSeverity = "very low" | "low" | "medium" | "high" | "critical";

export type ContaminationStatus =
  | "active"
  | "resolved"
  | "quarantined"
  | "archived"
  | "under investigation";

export type ContaminationSource =
  | "airborne"
  | "cross"
  | "media"
  | "observed"
  | "tool"
  | "transferred"
  | "unknown";

export interface Contamination {
  id: string;
  workspace_id: string | null;
  type: ContaminationType | (string & {}) | null;
  /** The description when `type` is `"other"`. */
  type_other: string | null;
  issue: string;
  description: string | null;
  notes: string | null;
  severity: string;
  status: string;
  observed_at: string | null;
  resolved_at: string | null;
  vessels_affected: number | null;
  plants_affected: number | null;
  affected_vessel_markings: string | null;
  custom_fields: CustomFieldValues;
  plant_ids: string[];
  explant_ids: string[];
  logged_by: string;
  created_at: string | null;
  updated_at: string | null;
}

/** Filters accepted by `contaminations.list()`. */
export interface ContaminationListParams extends PageParams {
  plant_id?: string;
  explant_id?: string;
  status?: ContaminationStatus;
  /** ISO 8601 — only contaminations logged at or after this instant. */
  since?: string;
}

/** Payload sent when logging a contamination. */
export interface ContaminationCreateInput {
  plant_id?: string;
  explant_id?: string;
  type: ContaminationType;
  /** Required in practice when `type` is `"other"`. 1–200 characters. */
  type_other?: string;
  /** A short summary, 1–300 characters. */
  issue: string;
  /** Up to 5000 characters. */
  description?: string;
  /** Up to 5000 characters. */
  notes?: string;
  severity?: ContaminationSeverity;
  status?: ContaminationStatus;
  suspected_source?: ContaminationSource;
  /** ISO 8601. Defaults to now. */
  observed_at?: string;
  vessels_affected?: number;
  plants_affected?: number;
  /** Up to 500 characters. */
  affected_vessel_markings?: string;
  custom_fields?: CustomFieldValues | null;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/** The records a comment can be attached to. */
export type CommentEntityType =
  | "plant"
  | "explant"
  | "contamination"
  | "task"
  | "media_recipe"
  | "sop";

/** A link from a comment to another record. */
export interface CommentReference {
  entity_type: CommentEntityType;
  entity_id: string;
  /** 1–200 characters. */
  label: string;
}

export interface Comment {
  id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  /** The comment this replies to, or `null` for a top-level comment. */
  parent_id: string | null;
  body: string;
  status: string;
  is_pinned: boolean;
  author: { id: string; name: string | null };
  mentioned_user_ids: string[];
  references: CommentReference[];
  created_at: string | null;
  updated_at: string | null;
  edited_at: string | null;
}

/** The record whose comments `comments.list()` returns, plus paging. */
export interface CommentListParams extends PageParams {
  entity_type: CommentEntityType;
  entity_id: string;
}

/** Payload sent when adding a comment. */
export interface CommentCreateInput {
  entity_type: CommentEntityType;
  entity_id: string;
  /**
   * 1–5000 characters. A body containing a signed URL that will expire is
   * refused with 422 — link to the record instead.
   */
  body: string;
  /** Reply to this comment. */
  parent_id?: string;
  /** Workspace members to notify. */
  mentioned_user_ids?: string[];
  references?: CommentReference[];
}

// ---------------------------------------------------------------------------
// Assets — photos and media on records
// ---------------------------------------------------------------------------

/** The records an asset can be attached to. */
export type AssetTarget = "plant" | "explant" | "contamination" | "sop";

export interface Asset {
  id: string;
  target: AssetTarget;
  target_id: string;
  kind: string;
  file_name: string | null;
  content_type: string | null;
  caption: string | null;
  captured_at: string | null;
  uploaded_by: string | null;
  created_at: string | null;
  /**
   * A short-lived link to the file. It stops working at `view_url_expires_at`
   * (about 15 minutes) — fetch the asset again for a fresh one, and never store
   * it.
   */
  view_url: string | null;
  view_url_expires_at: string | null;
}

/** The record whose assets `assets.list()` returns, plus paging. */
export interface AssetListParams extends PageParams {
  target: AssetTarget;
  target_id: string;
}

interface AssetCreateFields {
  target: AssetTarget;
  target_id: string;
  /** 1–200 characters. */
  filename?: string;
  /** 1–500 characters. */
  caption?: string;
}

/**
 * Payload sent when attaching an image: either a URL the API fetches, or the
 * file's bytes as base64. A file that is too large answers
 * `413 PAYLOAD_TOO_LARGE`; an unsupported type `415 UNSUPPORTED_MEDIA_TYPE`; a
 * URL that could not be fetched `422 IMAGE_URL_FETCH_FAILED`.
 */
export type AssetCreateInput = AssetCreateFields &
  (
    | { /** A public https URL, up to 2048 characters. */ image_url: string; image_base64?: never }
    | { /** The file's bytes, base64-encoded. */ image_base64: string; image_url?: never }
  );

// ---------------------------------------------------------------------------
// Media recipes
// ---------------------------------------------------------------------------

export type MediaRecipeStatus = "active" | "archived" | "deprecated" | "draft" | "published";

export interface MediaRecipeComponent {
  id: string;
  name: string;
  /** Quantity as written, e.g. `"4.4"`. */
  qty: string;
  unit: string | null;
  concentration: string | null;
}

export interface MediaRecipe {
  id: string;
  title: string;
  status: string | null;
  origin: string | null;
  /** `"private"` or `"team"`. */
  visibility: string;
  is_public: boolean;
  notes: string | null;
  ph_target: number | null;
  sterilization_notes: string | null;
  storage_notes: string | null;
  usage_notes: string | null;
  components: MediaRecipeComponent[];
  version: number;
  created_by: string;
  created_at: string | null;
}

/** Filters accepted by `mediaRecipes.list()`. */
export interface MediaRecipeListParams extends PageParams {
  status?: MediaRecipeStatus;
}

/** A component in a recipe you write. `id` is optional; one is generated. */
export interface MediaRecipeComponentInput {
  id?: string;
  /** 1–200 characters. */
  name: string;
  /** 1–50 characters, e.g. `"4.4"`. */
  qty: string;
  /** 1–20 characters, e.g. `"g/L"`. */
  unit?: string;
  concentration?: string;
}

/** Payload sent when creating a media recipe. */
export interface MediaRecipeCreateInput {
  /** 1–200 characters. */
  title: string;
  components: MediaRecipeComponentInput[];
  /** Up to 500 characters. */
  notes?: string;
  status?: MediaRecipeStatus;
  visibility?: "private" | "team";
  is_public?: boolean;
  origin?: "user" | "imported";
  /** 0–14. */
  ph_target?: number | null;
  sterilization_notes?: string | null;
  storage_notes?: string | null;
  usage_notes?: string | null;
}

/**
 * Payload sent when updating a media recipe. Only the fields you send change.
 * A teammate's recipe answers `403 MEDIA_RECIPE_NOT_OWNER`.
 */
export type MediaRecipeUpdateInput = Partial<Omit<MediaRecipeCreateInput, "origin" | "notes">> & {
  notes?: string | null;
};

// ---------------------------------------------------------------------------
// Culture line pricing
// ---------------------------------------------------------------------------

export interface CultureLinePrice {
  id: string;
  /** The plant (culture line) this price is for. */
  plant_id: string;
  list_price: Money;
  wholesale_price: Money | null;
  previous_list_price: Money | null;
  pricing_tier: string | null;
  tier_score: string | null;
  price_source: string;
  price_source_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Filters accepted by `pricing.listCultureLines()`. */
export interface CultureLinePriceListParams extends PageParams {
  plant_id?: string;
  /** 1–40 characters. */
  pricing_tier?: string;
}

/** A change to a culture line's list price. */
export interface PriceEvent {
  id: string;
  plant_id: string;
  list_price: Money;
  previous_list_price: Money | null;
  price_source: string;
  changed_by: string | null;
  changed_at: string | null;
}

/** Filters accepted by `pricing.listEvents()`. */
export interface PriceEventListParams extends PageParams {
  plant_id?: string;
  /** ISO 8601. */
  from?: string;
  /** ISO 8601. */
  to?: string;
}

// ---------------------------------------------------------------------------
// Commerce — store order lines and sell-through
// ---------------------------------------------------------------------------

/** One line of a store order, as read from a connected store. */
export interface OrderLine {
  id: string;
  product_link_id: string | null;
  plant_id: string | null;
  store_product_id: string | null;
  store_variant_id: string | null;
  quantity: number;
  unit_price: Money | null;
  occurred_at: string | null;
}

/** Filters accepted by `commerce.listOrderLines()`. */
export interface OrderLineListParams extends PageParams {
  /** ISO 8601. */
  from?: string;
  /** ISO 8601. */
  to?: string;
  product_link_id?: string;
}

/**
 * Units sold and revenue for one culture line in one currency. Revenue is never
 * summed across currencies: a line sold in two currencies is two rows.
 */
export interface SellThroughRow {
  plant_id: string | null;
  currency: string | null;
  units: number;
  revenue: Money;
  order_line_count: number;
  /** Order lines that carried a price. Revenue covers these only. */
  priced_line_count: number;
  first_occurred_at: string | null;
  last_occurred_at: string | null;
}

/** Filters accepted by `commerce.getSellThrough()`. */
export interface SellThroughParams {
  /** ISO 8601. */
  from?: string;
  /** ISO 8601. */
  to?: string;
  plant_id?: string;
  /** Defaults to 50, capped at 200. */
  limit?: number;
  offset?: number;
}
